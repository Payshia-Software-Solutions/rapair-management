<?php
/**
 * Base Model
 * Provides access to the Database object.
 */

class Model {
    protected $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function getDb() {
        return $this->db;
    }
}
