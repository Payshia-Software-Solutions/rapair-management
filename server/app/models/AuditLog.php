<?php
/**
 * Audit Log Model
 */
class AuditLog extends Model {
    private $table = 'audit_logs';

    public function write($data) {
        $this->db->query("INSERT INTO {$this->table} (user_id, action, entity, entity_id, method, path, ip, user_agent, details) VALUES (:user_id, :action, :entity, :entity_id, :method, :path, :ip, :user_agent, :details)");
        $this->db->bind(':user_id', $data['user_id']);
        $this->db->bind(':action', $data['action']);
        $this->db->bind(':entity', $data['entity']);
        $this->db->bind(':entity_id', $data['entity_id']);
        $this->db->bind(':method', $data['method']);
        $this->db->bind(':path', $data['path']);
        $this->db->bind(':ip', $data['ip']);
        $this->db->bind(':user_agent', $data['user_agent']);
        $this->db->bind(':details', $data['details']);
        return $this->db->execute();
    }
}

