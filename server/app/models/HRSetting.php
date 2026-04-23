<?php
/**
 * HRSetting Model
 */
class HRSetting extends Model {
    private $table = 'hr_settings';

    public function getAll() {
        $this->db->query("SELECT setting_key, setting_value FROM {$this->table}");
        $rows = $this->db->resultSet();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r->setting_key] = $r->setting_value;
        }
        return $settings;
    }

    public function get($key, $default = null) {
        $this->db->query("SELECT setting_value FROM {$this->table} WHERE setting_key = :k LIMIT 1");
        $this->db->bind(':k', $key);
        $row = $this->db->single();
        return $row ? $row->setting_value : $default;
    }

    public function update($key, $value) {
        $this->db->query("
            INSERT INTO {$this->table} (setting_key, setting_value) 
            VALUES (:k, :v) 
            ON DUPLICATE KEY UPDATE setting_value = :v
        ");
        $this->db->bind(':k', $key);
        $this->db->bind(':v', (string)$value);
        return $this->db->execute();
    }
}
