<?php
/**
 * ChecklistTemplate Model (Global checklist repository)
 */
class ChecklistTemplate extends Model {
    private $table = 'checklist_templates';

    public function __construct() {
        parent::__construct();
        $this->ensureChecklistTemplateSchema();
    }

    private function ensureChecklistTemplateSchema() {
        // Add standard_mileage
        $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'standard_mileage'");
        if (!$this->db->single()) {
            $this->db->query("ALTER TABLE {$this->table} ADD COLUMN standard_mileage INT NULL AFTER description");
            $this->db->execute();
        }

        // Add extended_description
        $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'extended_description'");
        if (!$this->db->single()) {
            $this->db->query("ALTER TABLE {$this->table} ADD COLUMN extended_description TEXT NULL AFTER standard_mileage");
            $this->db->execute();
        }

        // Add linkage columns: category_name, job_type, request_keywords
        $addedLinkCols = false;
        $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'category_name'");
        if (!$this->db->single()) {
            $this->db->query("ALTER TABLE {$this->table} ADD COLUMN category_name VARCHAR(255) NULL AFTER extended_description");
            $this->db->execute();
            $addedLinkCols = true;
        }

        $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'job_type'");
        if (!$this->db->single()) {
            $this->db->query("ALTER TABLE {$this->table} ADD COLUMN job_type VARCHAR(64) NULL AFTER category_name");
            $this->db->execute();
            $addedLinkCols = true;
        }

        $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'request_keywords'");
        if (!$this->db->single()) {
            $this->db->query("ALTER TABLE {$this->table} ADD COLUMN request_keywords VARCHAR(500) NULL AFTER job_type");
            $this->db->execute();
            $addedLinkCols = true;
        }

        if ($addedLinkCols) {
            $this->backfillDefaultLinks();
        }
    }

    private function inferLinkageDefaults($description) {
        $d = strtolower((string)$description);

        $catNames = [];
        try {
            $this->db->query("SELECT name FROM repair_categories");
            $rows = $this->db->resultSet() ?: [];
            foreach ($rows as $r) $catNames[] = (string)$r->name;
        } catch (Exception $e) {}

        $resolveCat = function ($hint) use ($catNames) {
            if (empty($catNames)) return $hint;
            foreach ($catNames as $cn) {
                if (strcasecmp($cn, $hint) === 0 || stripos($cn, explode(' ', $hint)[0]) !== false) {
                    return $cn;
                }
            }
            return $hint;
        };

        if (preg_match('/(engine oil|oil filter|air filter|fuel filter|water separator|grease|fluid|coolant)/i', $d)) {
            $kw = 'full service';
            if (strpos($d, 'oil') !== false) $kw .= ', oil, oil change, filter';
            if (strpos($d, 'air') !== false) $kw .= ', air filter, filter';
            if (strpos($d, 'fuel') !== false || strpos($d, 'separator') !== false) $kw .= ', fuel, fuel filter, water separator';
            return [
                'category_name' => $resolveCat('Scheduled Preventative Maintenance'),
                'job_type' => 'Service Booking',
                'request_keywords' => $kw,
            ];
        }
        if (preg_match('/(brake|pad|disc|rotor|caliper|air line|abs)/i', $d)) {
            return [
                'category_name' => $resolveCat('Braking Systems & Air Lines'),
                'job_type' => null,
                'request_keywords' => 'brake, brakes, pad, disc',
            ];
        }
        if (preg_match('/(tire|tyre|wheel|alignment|balanc)/i', $d)) {
            return [
                'category_name' => $resolveCat('Tire Replacement, Alignment, and Balancing'),
                'job_type' => null,
                'request_keywords' => 'wheel, tire, tyre, alignment, balancing',
            ];
        }
        if (preg_match('/(battery|light|electrical|alternator|starter|wiring|ac |a\/c|air cond)/i', $d)) {
            return [
                'category_name' => $resolveCat('Electrical, Battery, and Lighting'),
                'job_type' => null,
                'request_keywords' => 'battery, light, electrical, ac, regas',
            ];
        }
        if (preg_match('/(suspension|chassis|leaf|spring|shock|steering|bush|axle)/i', $d)) {
            return [
                'category_name' => $resolveCat('Chassis, Suspension, and Leaf Springs'),
                'job_type' => null,
                'request_keywords' => 'suspension, chassis, steering, noise',
            ];
        }
        if (preg_match('/(engine|diagnostic|injector|turbo|exhaust|overheat|timing|spark)/i', $d)) {
            return [
                'category_name' => $resolveCat('Engine & Fuel System Repairs'),
                'job_type' => null,
                'request_keywords' => 'engine, diagnostic, fuel',
            ];
        }
        if (preg_match('/(body|weld|cabin|dent|paint|bumper|door|glass|wiper)/i', $d)) {
            return [
                'category_name' => $resolveCat('Bodywork, Welding, and Cabin Repairs'),
                'job_type' => null,
                'request_keywords' => 'body, weld, dent, cabin',
            ];
        }
        return ['category_name' => null, 'job_type' => null, 'request_keywords' => null];
    }

    private function backfillDefaultLinks() {
        try {
            $this->db->query("SELECT id, description FROM {$this->table} WHERE category_name IS NULL AND job_type IS NULL AND request_keywords IS NULL");
            $rows = $this->db->resultSet() ?: [];
            foreach ($rows as $row) {
                $links = $this->inferLinkageDefaults($row->description ?? '');
                if ($links['category_name'] || $links['job_type'] || $links['request_keywords']) {
                    $this->db->query("UPDATE {$this->table} SET category_name = :cat, job_type = :jt, request_keywords = :kw WHERE id = :id");
                    $this->db->bind(':cat', $links['category_name']);
                    $this->db->bind(':jt', $links['job_type']);
                    $this->db->bind(':kw', $links['request_keywords']);
                    $this->db->bind(':id', (int)$row->id);
                    $this->db->execute();
                }
            }
        } catch (Exception $e) {
            error_log('ChecklistTemplate::backfillDefaultLinks: ' . $e->getMessage());
        }
    }

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY id DESC");
        return $this->db->resultSet();
    }

    public function create($description, $mileage = null, $extendedDesc = null, $userId = null, $categoryName = null, $jobType = null, $requestKeywords = null) {
        $this->db->query("INSERT INTO {$this->table} (description, standard_mileage, extended_description, category_name, job_type, request_keywords, created_by, updated_by) VALUES (:description, :standard_mileage, :extended_description, :category_name, :job_type, :request_keywords, :created_by, :updated_by)");
        $this->db->bind(':description', $description);
        $this->db->bind(':standard_mileage', $mileage);
        $this->db->bind(':extended_description', $extendedDesc);
        $this->db->bind(':category_name', $categoryName ?: null);
        $this->db->bind(':job_type', $jobType ?: null);
        $this->db->bind(':request_keywords', $requestKeywords ?: null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $description, $mileage = null, $extendedDesc = null, $userId = null, $categoryName = null, $jobType = null, $requestKeywords = null) {
        $this->db->query("UPDATE {$this->table} SET description = :description, standard_mileage = :standard_mileage, extended_description = :extended_description, category_name = :category_name, job_type = :job_type, request_keywords = :request_keywords, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':description', $description);
        $this->db->bind(':standard_mileage', $mileage);
        $this->db->bind(':extended_description', $extendedDesc);
        $this->db->bind(':category_name', $categoryName ?: null);
        $this->db->bind(':job_type', $jobType ?: null);
        $this->db->bind(':request_keywords', $requestKeywords ?: null);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
