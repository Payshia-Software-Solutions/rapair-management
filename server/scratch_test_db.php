<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

try {
    $db = new Database();
    echo "Connection successful\n";
    
    $db->query("SELECT COUNT(*) as count FROM users");
    $result = $db->single();
    echo "User count: " . $result->count . "\n";
    
    $db->query("SELECT id, name, email FROM users LIMIT 5");
    $users = $db->resultSet();
    foreach ($users as $user) {
        echo "ID: {$user->id}, Name: {$user->name}, Email: {$user->email}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
