<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

class ExportSeeder {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function seed() {
        echo "Starting Export Seeding...\n";

        // 1. Seed Container Types
        $this->seedContainers();

        // 2. Seed Packaging Types
        $this->seedPackaging();

        // 3. Seed Pallet Types
        $this->seedPallets();

        // 4. Update Sample Parts with Logistics Data
        $this->seedSampleParts();

        echo "Seeding Completed Successfully!\n";
    }

    private function seedContainers() {
        echo "Seeding Containers...\n";
        $containers = [
            ['name' => '20ft Standard', 'max_cbm_capacity' => 33.00, 'max_weight_capacity_kg' => 28000, 'max_standard_pallets' => 11],
            ['name' => '40ft Standard', 'max_cbm_capacity' => 67.00, 'max_weight_capacity_kg' => 28000, 'max_standard_pallets' => 21],
            ['name' => '40ft High Cube', 'max_cbm_capacity' => 76.00, 'max_weight_capacity_kg' => 28000, 'max_standard_pallets' => 21]
        ];

        foreach ($containers as $c) {
            $this->db->query("SELECT id FROM export_container_types WHERE name = :name");
            $this->db->bind(':name', $c['name']);
            if (!$this->db->single()) {
                $this->db->query("INSERT INTO export_container_types (name, max_cbm_capacity, max_weight_capacity_kg, max_standard_pallets) VALUES (:name, :cbm, :weight, :pallets)");
                $this->db->bind(':name', $c['name']);
                $this->db->bind(':cbm', $c['max_cbm_capacity']);
                $this->db->bind(':weight', $c['max_weight_capacity_kg']);
                $this->db->bind(':pallets', $c['max_standard_pallets']);
                $this->db->execute();
                echo " Added Container: {$c['name']}\n";
            }
        }
    }

    private function seedPackaging() {
        echo "Seeding Packaging Types...\n";
        $packaging = [
            ['name' => 'Standard Carton A', 'type' => 'Carton', 'length_cm' => 30, 'width_cm' => 30, 'height_cm' => 30, 'cbm' => 0.027, 'tare_weight_kg' => 0.5, 'max_weight_capacity_kg' => 15],
            ['name' => 'Standard Carton B', 'type' => 'Carton', 'length_cm' => 40, 'width_cm' => 40, 'height_cm' => 40, 'cbm' => 0.064, 'tare_weight_kg' => 0.8, 'max_weight_capacity_kg' => 25],
            ['name' => 'Canister 500ml', 'type' => 'Canister', 'length_cm' => 10, 'width_cm' => 10, 'height_cm' => 15, 'cbm' => 0.0015, 'tare_weight_kg' => 0.05, 'max_weight_capacity_kg' => 1],
            ['name' => 'Pouch 250g', 'type' => 'Pouch', 'length_cm' => 15, 'width_cm' => 5, 'height_cm' => 20, 'cbm' => 0.0015, 'tare_weight_kg' => 0.01, 'max_weight_capacity_kg' => 0.5]
        ];

        foreach ($packaging as $p) {
            $this->db->query("SELECT id FROM export_packaging_types WHERE name = :name");
            $this->db->bind(':name', $p['name']);
            if (!$this->db->single()) {
                $this->db->query("INSERT INTO export_packaging_types (name, type, length_cm, width_cm, height_cm, cbm, tare_weight_kg, max_weight_capacity_kg) VALUES (:name, :type, :l, :w, :h, :cbm, :tare, :max)");
                $this->db->bind(':name', $p['name']);
                $this->db->bind(':type', $p['type']);
                $this->db->bind(':l', $p['length_cm']);
                $this->db->bind(':w', $p['width_cm']);
                $this->db->bind(':h', $p['height_cm']);
                $this->db->bind(':cbm', $p['cbm']);
                $this->db->bind(':tare', $p['tare_weight_kg']);
                $this->db->bind(':max', $p['max_weight_capacity_kg']);
                $this->db->execute();
                echo " Added Packaging: {$p['name']}\n";
            }
        }
    }

    private function seedPallets() {
        echo "Seeding Pallet Types...\n";
        $pallets = [
            ['name' => 'Standard Wood (120x100)', 'length_cm' => 120, 'width_cm' => 100, 'max_load_height_cm' => 180, 'tare_weight_kg' => 25, 'max_weight_capacity_kg' => 1500],
            ['name' => 'Euro Pallet (120x80)', 'length_cm' => 120, 'width_cm' => 80, 'max_load_height_cm' => 160, 'tare_weight_kg' => 20, 'max_weight_capacity_kg' => 1200],
            ['name' => 'Plastic Pallet (110x110)', 'length_cm' => 110, 'width_cm' => 110, 'max_load_height_cm' => 150, 'tare_weight_kg' => 15, 'max_weight_capacity_kg' => 1000]
        ];

        foreach ($pallets as $p) {
            $this->db->query("SELECT id FROM export_pallet_types WHERE name = :name");
            $this->db->bind(':name', $p['name']);
            if (!$this->db->single()) {
                $this->db->query("INSERT INTO export_pallet_types (name, length_cm, width_cm, max_load_height_cm, tare_weight_kg, max_weight_capacity_kg) VALUES (:name, :l, :w, :h, :tare, :max)");
                $this->db->bind(':name', $p['name']);
                $this->db->bind(':l', $p['length_cm']);
                $this->db->bind(':w', $p['width_cm']);
                $this->db->bind(':h', $p['max_load_height_cm']);
                $this->db->bind(':tare', $p['tare_weight_kg']);
                $this->db->bind(':max', $p['max_weight_capacity_kg']);
                $this->db->execute();
                echo " Added Pallet: {$p['name']}\n";
            }
        }
    }

    private function seedSampleParts() {
        echo "Updating Sample Parts with Export Data...\n";
        
        // Get some existing parts
        $this->db->query("SELECT id FROM parts LIMIT 10");
        $parts = $this->db->resultSet();

        $count = 0;
        foreach ($parts as $p) {
            $this->db->query("UPDATE parts SET 
                net_weight_kg = :net, 
                gross_weight_kg = :gross, 
                hs_code = :hs, 
                packing_type = :pack,
                units_per_carton = :upc,
                carton_length_cm = :l,
                carton_width_cm = :w,
                carton_height_cm = :h,
                volume_cbm = :v
                WHERE id = :id");
            
            $this->db->bind(':id', $p->id);
            $this->db->bind(':net', 0.250);
            $this->db->bind(':gross', 0.260);
            $this->db->bind(':hs', '0902.10.00'); // Example: Tea
            $this->db->bind(':pack', 'Standard Carton A');
            $this->db->bind(':upc', 24);
            $this->db->bind(':l', 30);
            $this->db->bind(':w', 30);
            $this->db->bind(':h', 30);
            $this->db->bind(':v', 0.027);
            
            $this->db->execute();
            $count++;
        }
        echo " Updated $count sample parts with logistics info.\n";
    }
}

$seeder = new ExportSeeder();
$seeder->seed();
