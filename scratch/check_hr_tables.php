<?php
require_once 'server/config/config.php';
try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Checking Table: hr_salary_templates...\n";
    $stmt = $pdo->query("SHOW TABLES LIKE 'hr_salary_templates'");
    if ($stmt->fetch()) {
        echo "Table exists.\n";
        $stmt = $pdo->query("DESCRIBE hr_salary_templates");
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    } else {
        echo "Table NOT FOUND!\n";
    }

    echo "\nChecking Table: hr_salary_template_items...\n";
     $stmt = $pdo->query("SHOW TABLES LIKE 'hr_salary_template_items'");
    if ($stmt->fetch()) {
        echo "Table exists.\n";
    } else {
        echo "Table NOT FOUND!\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
