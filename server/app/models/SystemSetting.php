<?php
/**
 * SystemSetting Model
 * Manages global system configurations.
 */
class SystemSetting extends Model {
    private $table = 'system_settings';

    public function __construct() {
        parent::__construct();
        SystemSchema::ensure();
    }

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table}");
        $rows = $this->db->resultSet();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row->setting_key] = $row->setting_value;
        }
        return $settings;
    }

    public function update($key, $value) {
        $this->db->query("
            INSERT INTO {$this->table} (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value_upd
        ");
        $this->db->bind(':key', $key);
        $this->db->bind(':value', $value);
        $this->db->bind(':value_upd', $value);
        return $this->db->execute();
    }

    public function get($key, $default = null) {
        $this->db->query("SELECT setting_value FROM {$this->table} WHERE setting_key = :key LIMIT 1");
        $this->db->bind(':key', $key);
        $row = $this->db->single();
        return $row ? $row->setting_value : $default;
    }
}
