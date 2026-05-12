<?php
/**
 * Audit Log Model
 */
class AuditLog extends Model {
    private $table = 'audit_logs';

    public function write($data) {
        try {
            $this->db->query("INSERT INTO {$this->table} (user_id, location_id, action, entity, entity_id, method, path, ip, user_agent, details) VALUES (:user_id, :location_id, :action, :entity, :entity_id, :method, :path, :ip, :user_agent, :details)");
            $this->db->bind(':user_id', $data['user_id']);
            $this->db->bind(':location_id', $data['location_id'] ?? null);
            $this->db->bind(':action', $data['action']);
            $this->db->bind(':entity', $data['entity']);
            $this->db->bind(':entity_id', $data['entity_id'] ?? null);
            $this->db->bind(':method', $data['method'] ?? $_SERVER['REQUEST_METHOD'] ?? 'CLI');
            $this->db->bind(':path', $data['path'] ?? $_SERVER['REQUEST_URI'] ?? 'CLI');
            $this->db->bind(':ip', $data['ip'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
            $this->db->bind(':user_agent', $data['user_agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? 'CLI');
            $this->db->bind(':details', $data['details'] ?? null);
            return $this->db->execute();
        } catch (Exception $e) {
            error_log("AuditLog::write error: " . $e->getMessage());
            return false;
        }
    }
}
