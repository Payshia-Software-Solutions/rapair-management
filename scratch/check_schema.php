<?php
$db = new PDO('mysql:host=localhost;dbname=saas_master_db', 'root', '');
$res = $db->query('DESCRIBE saas_packages')->fetchAll(PDO::FETCH_ASSOC);
print_r($res);
