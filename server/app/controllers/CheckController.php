<?php
/**
 * CheckController - verifies required tables exist and creates missing ones.
 */
class CheckController extends Controller {
    private $db;
    private $requiredTables = [
        // Core business tables
        'repair_orders',
        'technicians',
        'service_bays',
        'repair_categories',
        'checklist_items',
        'parts',
        'order_parts',
        'units',
        'suppliers',
        'purchase_orders',
        'purchase_order_items',
        'goods_receive_notes',
        'grn_items',
        'stock_movements',
        'stock_adjustments',
        'stock_adjustment_items',
        'vehicles',
        'vehicle_makes',
        'vehicle_models',
        // Auth/RBAC + setup tables
        'users',
        'audit_logs',
        'checklist_templates',
        'roles',
        'permissions',
        'role_permissions',
        'company',
        'service_locations',
        'departments',
        'user_locations'
    ];

    public function __construct() {
        // Other controllers use models (which create their own Database instance).
        // This controller queries table existence directly, so it needs its own DB handle.
        try { InventorySchema::ensure(); } catch (Exception $e) {}
        try { UnitSchema::ensure(); } catch (Exception $e) {}
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
