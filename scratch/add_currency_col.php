<?php
$db = new PDO('mysql:host=localhost;dbname=saas_master_db', 'root', '');
$db->exec("ALTER TABLE saas_tenants ADD COLUMN currency VARCHAR(10) DEFAULT 'USD' AFTER package_id");
echo "Column added successfully";
