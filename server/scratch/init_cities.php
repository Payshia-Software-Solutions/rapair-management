<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

// 1. Create cities table
echo "Creating cities table...\n";
$db->query("CREATE TABLE IF NOT EXISTS cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    district_id INT NOT NULL,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
)");
$db->execute();

// 2. Add district_id and city_id to customers table if not exists
echo "Adding district_id and city_id to customers table...\n";
try {
    $db->query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS district_id INT NULL");
    $db->execute();
    $db->query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS city_id INT NULL");
    $db->execute();
} catch (Exception $e) {
    echo "Columns might already exist: " . $e->getMessage() . "\n";
}

// 3. Populate cities
echo "Populating cities...\n";
$cities = [
    'Colombo' => ['Colombo 1-15', 'Dehiwala', 'Mount Lavinia', 'Moratuwa', 'Kotte', 'Kaduwela', 'Battaramulla'],
    'Gampaha' => ['Gampaha', 'Negombo', 'Katunayake', 'Veyangoda', 'Minuwangoda', 'Ja-Ela', 'Kelaniya'],
    'Kandy' => ['Kandy', 'Peradeniya', 'Katugastota', 'Gampola', 'Nawalapitiya', 'Akurana'],
    'Galle' => ['Galle', 'Hikkaduwa', 'Karapitiya', 'Ambalangoda', 'Elpitiya'],
    'Matara' => ['Matara', 'Weligama', 'Dickwella', 'Hakmana'],
    'Kalutara' => ['Kalutara', 'Panadura', 'Horana', 'Beruwala'],
    'Kurunegala' => ['Kurunegala', 'Kuliyapitiya', 'Narammala', 'Pannala'],
    'Anuradhapura' => ['Anuradhapura', 'Mihintale', 'Thambuttegama'],
    'Badulla' => ['Badulla', 'Bandarawela', 'Hali-Ela', 'Ella'],
    'Ratnapura' => ['Ratnapura', 'Embilipitiya', 'Balangoda'],
    'Kegalle' => ['Kegalle', 'Mawanella', 'Warakapola'],
    'Jaffna' => ['Jaffna', 'Chavakachcheri', 'Point Pedro'],
    'Trincomalee' => ['Trincomalee', 'Kinniya'],
    'Batticaloa' => ['Batticaloa', 'Kattankudy'],
    'Ampara' => ['Ampara', 'Samanthurai'],
    'Puttalam' => ['Puttalam', 'Chilaw', 'Wennappuwa'],
    'Nuwara Eliya' => ['Nuwara Eliya', 'Hatton', 'Talawakele'],
    'Hambantota' => ['Hambantota', 'Tangalle', 'Beliatta'],
    'Matale' => ['Matale', 'Dambulla', 'Sigiriya'],
    'Polonnaruwa' => ['Polonnaruwa', 'Kaduruwela'],
    'Moneragala' => ['Moneragala', 'Wellawaya'],
    'Vavuniya' => ['Vavuniya'],
    'Mannar' => ['Mannar'],
    'Mullaitivu' => ['Mullaitivu'],
    'Kilinochchi' => ['Kilinochchi']
];

foreach ($cities as $districtName => $cityList) {
    // Get district ID
    $db->query("SELECT id FROM districts WHERE name = :name");
    $db->bind(':name', $districtName);
    $district = $db->single();
    
    if ($district) {
        foreach ($cityList as $cityName) {
            // Check if city exists
            $db->query("SELECT id FROM cities WHERE name = :name AND district_id = :did");
            $db->bind(':name', $cityName);
            $db->bind(':did', $district->id);
            if (!$db->single()) {
                $db->query("INSERT INTO cities (name, district_id) VALUES (:name, :did)");
                $db->bind(':name', $cityName);
                $db->bind(':did', $district->id);
                $db->execute();
            }
        }
    }
}

echo "Done!\n";
