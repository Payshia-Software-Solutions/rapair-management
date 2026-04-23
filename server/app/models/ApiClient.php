<?php
/**
 * ApiClient Model
 * Manages domain-specific API keys and their validation.
 */
class ApiClient extends Model {
    private $table = 'api_clients';

    public function __construct() {
        parent::__construct();
        ApiClientsSchema::ensure();
    }

    public function list() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY client_name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $key = bin2hex(random_bytes(32));
        $this->db->query("
            INSERT INTO {$this->table} (client_name, domain, api_key, created_by, updated_by)
            VALUES (:name, :domain, :key, :u, :u)
        ");
        $this->db->bind(':name', $data['client_name']);
        $this->db->bind(':domain', $data['domain']);
        $this->db->bind(':key', $key);
        $this->db->bind(':u', $userId);
        
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function regenerateKey($id, $userId = null) {
        $newKey = bin2hex(random_bytes(32));
        $this->db->query("UPDATE {$this->table} SET api_key = :key, updated_by = :u WHERE id = :id");
        $this->db->bind(':key', $newKey);
        $this->db->bind(':u', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute() ? $newKey : false;
    }

    public function toggleStatus($id, $isActive, $userId = null) {
        $this->db->query("UPDATE {$this->table} SET is_active = :status, updated_by = :u WHERE id = :id");
        $this->db->bind(':status', $isActive ? 1 : 0);
        $this->db->bind(':u', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    /**
     * Validates if a key belongs to a domain.
     * @param string $key The API Key from header
     * @param string $origin The Clean Origin (Domain) from header
     */
    public function validate($key, $origin) {
        if (empty($key)) return false;

        $this->db->query("SELECT * FROM {$this->table} WHERE api_key = :key AND is_active = 1 LIMIT 1");
        $this->db->bind(':key', $key);
        $client = $this->db->single();

        if (!$client) return false;

        // Domain validation
        $targetDomain = rtrim(strtolower($client->domain), '/');
        $requestOrigin = rtrim(strtolower($origin), '/');

        // If domain is specified as '*', allow everything (useful for testing)
        if ($targetDomain === '*') return true;

        return $targetDomain === $requestOrigin;
    }
}
