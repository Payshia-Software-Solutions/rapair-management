<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$res = $db->query('SHOW TABLES');
while($row = $res->fetch()) {
    echo $row[0] . "\n";
}
