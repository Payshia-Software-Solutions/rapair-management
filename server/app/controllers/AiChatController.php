<?php
/**
 * AiChatController - saved conversations for the AI assistant page (one list per user).
 *
 *   GET  /api/ai-chat/list?q=          the user's conversations, newest first (optional title/message search)
 *   GET  /api/ai-chat/get?id=          one conversation with its messages
 *   POST /api/ai-chat/append           {id?, title?, messages:[{role, content, meta?}]}  creates the conversation
 *                                      when id is missing, then adds the messages; returns {id}
 *   POST /api/ai-chat/rename           {id, title}
 *   POST /api/ai-chat/feedback         {message_id, value: 1|-1|0}
 *   POST /api/ai-chat/delete           {id}
 *
 * Answers still come from /api/intelligence/ask_stream; this only stores them.
 */
class AiChatController extends Controller {
    private $db;
    public function __construct() {
        $this->db = new Database();
    }

    /**
     * Runs an action; only if MySQL says the tables are missing (error 1146, i.e. the first use in
     * this workspace) it creates them and runs the action again. Normal requests cost no extra query.
     */
    private function withTables(callable $fn) {
        try {
            return $fn();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) !== 1146) throw $e;
            $this->createTables();
            return $fn();
        }
    }

    private function createTables() {
        try {
            $this->db->query("CREATE TABLE IF NOT EXISTS ai_conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(160) NOT NULL DEFAULT 'New chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_aic_user (user_id, updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $this->db->execute();
            $this->db->query("CREATE TABLE IF NOT EXISTS ai_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id INT NOT NULL,
                role ENUM('user','assistant') NOT NULL,
                content MEDIUMTEXT NOT NULL,
                meta TEXT NULL,
                feedback TINYINT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_aim_conv (conversation_id),
                FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $this->db->execute();
        } catch (Exception $e) {
            error_log('AiChat tables: ' . $e->getMessage());
        }
    }

    private function user() {
        $u = $this->requirePermission('reports.read');
        return (int)$u['sub'];
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    /** The conversation if it belongs to this user, else null. */
    private function owned($id, $uid) {
        $this->db->query("SELECT id, title, created_at, updated_at FROM ai_conversations WHERE id = :id AND user_id = :u");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':u', $uid);
        return $this->db->single() ?: null;
    }

    public function list() { $this->withTables(fn() => $this->do_list()); }

    private function do_list() {
        $uid = $this->user();
        $q = trim((string)($_GET['q'] ?? ''));
        if ($q !== '') {
            $this->db->query("SELECT c.id, c.title, c.updated_at FROM ai_conversations c
                WHERE c.user_id = :u AND (c.title LIKE :q OR EXISTS (SELECT 1 FROM ai_messages m WHERE m.conversation_id = c.id AND m.content LIKE :q2))
                ORDER BY c.updated_at DESC LIMIT 100");
            $this->db->bind(':q', "%$q%");
            $this->db->bind(':q2', "%$q%");
        } else {
            $this->db->query("SELECT id, title, updated_at FROM ai_conversations WHERE user_id = :u ORDER BY updated_at DESC LIMIT 100");
        }
        $this->db->bind(':u', $uid);
        $this->success($this->db->resultSet() ?: []);
    }

    public function get() { $this->withTables(fn() => $this->do_get()); }

    private function do_get() {
        $uid = $this->user();
        $c = $this->owned($_GET['id'] ?? 0, $uid);
        if (!$c) { $this->error('Conversation not found', 404); return; }
        $this->db->query("SELECT id, role, content, meta, feedback, created_at FROM ai_messages WHERE conversation_id = :c ORDER BY id");
        $this->db->bind(':c', (int)$c->id);
        $msgs = array_map(function ($m) {
            $m->meta = $m->meta ? json_decode($m->meta, true) : null;
            $m->feedback = (int)$m->feedback;
            return $m;
        }, $this->db->resultSet() ?: []);
        $c->messages = $msgs;
        $this->success($c);
    }

    public function append() { $this->withTables(fn() => $this->do_append()); }

    private function do_append() {
        $uid = $this->user();
        $d = $this->body();
        $msgs = is_array($d['messages'] ?? null) ? $d['messages'] : [];
        if (!$msgs) { $this->error('No messages', 400); return; }

        $id = (int)($d['id'] ?? 0);
        if ($id) {
            if (!$this->owned($id, $uid)) { $this->error('Conversation not found', 404); return; }
        } else {
            $title = trim((string)($d['title'] ?? ''));
            if ($title === '') $title = (string)($msgs[0]['content'] ?? 'New chat');
            $title = mb_substr(preg_replace('/\s+/', ' ', $title), 0, 80) ?: 'New chat';
            $this->db->query("INSERT INTO ai_conversations (user_id, title) VALUES (:u, :t)");
            $this->db->bind(':u', $uid);
            $this->db->bind(':t', $title);
            $this->db->execute();
            $id = (int)$this->db->lastInsertId();
        }

        $ids = [];
        foreach ($msgs as $m) {
            $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $content = (string)($m['content'] ?? '');
            if ($content === '') continue;
            $this->db->query("INSERT INTO ai_messages (conversation_id, role, content, meta) VALUES (:c, :r, :t, :m)");
            $this->db->bind(':c', $id);
            $this->db->bind(':r', $role);
            $this->db->bind(':t', $content);
            $this->db->bind(':m', isset($m['meta']) ? json_encode($m['meta'], JSON_UNESCAPED_UNICODE) : null);
            $this->db->execute();
            $ids[] = (int)$this->db->lastInsertId();
        }
        $this->db->query("UPDATE ai_conversations SET updated_at = NOW() WHERE id = :c");
        $this->db->bind(':c', $id);
        $this->db->execute();
        $this->success(['id' => $id, 'message_ids' => $ids]);
    }

    public function rename() { $this->withTables(fn() => $this->do_rename()); }

    private function do_rename() {
        $uid = $this->user();
        $d = $this->body();
        $title = mb_substr(trim((string)($d['title'] ?? '')), 0, 80);
        if ($title === '') { $this->error('Enter a name', 422); return; }
        if (!$this->owned($d['id'] ?? 0, $uid)) { $this->error('Conversation not found', 404); return; }
        $this->db->query("UPDATE ai_conversations SET title = :t WHERE id = :id");
        $this->db->bind(':t', $title);
        $this->db->bind(':id', (int)$d['id']);
        $this->db->execute();
        $this->success(null, 'Renamed');
    }

    public function feedback() { $this->withTables(fn() => $this->do_feedback()); }

    private function do_feedback() {
        $uid = $this->user();
        $d = $this->body();
        $v = (int)($d['value'] ?? 0);
        $v = $v > 0 ? 1 : ($v < 0 ? -1 : 0);
        $this->db->query("UPDATE ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id
            SET m.feedback = :v WHERE m.id = :id AND c.user_id = :u AND m.role = 'assistant'");
        $this->db->bind(':v', $v);
        $this->db->bind(':id', (int)($d['message_id'] ?? 0));
        $this->db->bind(':u', $uid);
        $this->db->execute();
        $this->success(null, 'Saved');
    }

    public function delete() { $this->withTables(fn() => $this->do_delete()); }

    private function do_delete() {
        $uid = $this->user();
        $d = $this->body();
        if (!$this->owned($d['id'] ?? 0, $uid)) { $this->error('Conversation not found', 404); return; }
        $this->db->query("DELETE FROM ai_conversations WHERE id = :id");
        $this->db->bind(':id', (int)$d['id']);
        $this->db->execute();
        $this->success(null, 'Deleted');
    }
}
