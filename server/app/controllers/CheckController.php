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
        'brands',
        'taxes',
        'suppliers',
        'part_suppliers',
        'purchase_orders',
        'purchase_order_items',
        'goods_receive_notes',
        'grn_items',
        'stock_movements',
        'stock_adjustments',
        'stock_adjustment_items',
        'stock_transfer_requests',
        'stock_transfer_items',
        'stock_transfer_requisitions',
        'stock_transfer_requisition_items',
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
        'user_locations',
        'customers',
        'invoices',
        'invoice_items',
        'invoice_payments'
    ];

    public function __construct() {
        // Other controllers use models (which create their own Database instance).
        // This controller queries table existence directly, so it needs its own DB handle.
        try { InventorySchema::ensure(); } catch (Exception $e) {}
        try { UnitSchema::ensure(); } catch (Exception $e) {}
        try { BrandSchema::ensure(); } catch (Exception $e) {}
        try { TaxSchema::ensure(); } catch (Exception $e) {}
        try { CustomerSchema::ensure(); } catch (Exception $e) {}
        try { InvoiceSchema::ensure(); } catch (Exception $e) {}
        try { CompanySchema::ensure(); } catch (Exception $e) {}
        $this->db = new Database();
    }

    public function check() {
        $checks = [];
        $missing = [];

        // Check if database is connected
        if ($this->db->getError()) {
            $this->json([
                'status' => 'error',
                'message' => 'Database connection failed. Please ensure MySQL is running.',
                'error' => $this->db->getError()
            ], 500);
            return;
        }

        try {
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
        } catch (Exception $e) {
            $this->json([
                'status' => 'error',
                'message' => 'Database error: ' . $e->getMessage()
            ], 500);
            return;
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
