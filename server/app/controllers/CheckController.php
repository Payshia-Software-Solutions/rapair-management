<?php
/**
 * CheckController - verifies required tables exist and creates missing ones.
 */
class CheckController extends Controller {
    private $db;
    private $requiredTables = [
        'repair_orders',
        'technicians',
        'service_bays',
        'repair_categories',
        'checklist_items',
        'parts',
        'order_parts',
        'vehicles',
        'vehicle_makes',
        'vehicle_models',
        'users',
        'audit_logs',
        'checklist_templates'
    ];

    public function __construct() {
        // Other controllers use models (which create their own Database instance).
        // This controller queries table existence directly, so it needs its own DB handle.
        $this->db = new Database();
    }

    public function check() {
        $checks = [];
        $missing = [];

        foreach ($this->requiredTables as $table) {
            $this->db->query("SHOW TABLES LIKE :tbl");
            $this->db->bind(':tbl', $table);
            $result = $this->db->single();
            $available = (bool) $result;

            $checks[] = [
                'name' => $table,
                'available' => $available,
                'message' => $available ? 'Table is available' : 'Table is missing'
            ];

            if (!$available) {
                $missing[] = $table;
            }
        }

        if (empty($missing)) {
            $this->json([
                'status' => 'success',
                'message' => 'All required tables are available',
                'checks' => $checks,
                'missingTables' => []
            ]);
            return;
        }

        $this->json([
            'status' => 'error',
            'message' => 'Some required tables are missing',
            'checks' => $checks,
            'missingTables' => $missing
        ], 200);
    }
}
?>
