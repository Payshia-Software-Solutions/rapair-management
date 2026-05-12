<?php
/**
 * ReturnController
 */
class ReturnController extends Controller {
    private $returnModel;
    private $invoiceModel;
    private $refundModel;
    private $auditModel;

    public function __construct() {
        // Ensure database tables exist
        require_once '../app/helpers/SalesReturnSchema.php';
        SalesReturnSchema::ensure();

        $this->returnModel = $this->model('SalesReturn');
        $this->invoiceModel = $this->model('Invoice');
        $this->refundModel = $this->model('Refund');
        $this->auditModel = $this->model('AuditLog');
    }

    public function index() {
        return $this->list();
    }

    public function list() {
        $this->requirePermission('pos.read');
        $filters = [
            'status' => $_GET['status'] ?? null,
            'location_id' => $_GET['location_id'] ?? null
        ];
        $returns = $this->returnModel->getAll($filters);
        $this->success($returns);
    }

    public function invoice_details($id = null) {
        return $this->invoice_lookup($id);
    }

    public function invoice_lookup($id = null) {
        $this->requirePermission('pos.read');
        $invoiceNo = $id ?? ($_GET['invoice_no'] ?? null);
        if (!$invoiceNo) {
            $this->error('Invoice Number required', 400);
            return;
        }

        // Search invoice by number - Super Flexible Lookup
        $db = new Database();
        
        $searchTerm = trim($invoiceNo);
        $cleanSearch = preg_replace('/[^A-Za-z0-9]/', '', $searchTerm); // Remove all symbols
        
        // Potential variations to check
        $variations = [
            $searchTerm,
            $cleanSearch,
            'INV-' . preg_replace('/[^0-9]/', '', $searchTerm), // try with hyphen if it was missing
            preg_replace('/[^0-9]/', '', $searchTerm) // try just the numbers
        ];

        // Remove duplicates/empty
        $variations = array_unique(array_filter($variations));

        $placeholders = [];
        foreach ($variations as $i => $v) {
            $placeholders[] = ":v$i";
        }
        $whereIn = implode(' OR i.invoice_no = ', $placeholders);

        $db->query("
            SELECT i.id, i.invoice_no, i.customer_id, c.name as customer_name, i.grand_total, i.paid_amount
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.invoice_no = $whereIn
            LIMIT 1
        ");

        foreach ($variations as $i => $v) {
            $db->bind(":v$i", $v);
        }
        $inv = $db->single();

        if (!$inv) {
            $this->error('Invoice not found', 404);
            return;
        }

        $db->query("
            SELECT ii.*, 
                   COALESCE((
                       SELECT SUM(sri.quantity) 
                       FROM sales_return_items sri 
                       JOIN sales_returns sr ON sri.return_id = sr.id 
                       WHERE sr.invoice_id = ii.invoice_id 
                         AND sri.item_id = ii.item_id 
                         AND sri.item_type = ii.item_type
                         AND sri.description = ii.description
                   ), 0) as returned_qty
            FROM invoice_items ii
            WHERE ii.invoice_id = :invoice_id
        ");
        $db->bind(':invoice_id', $inv->id);
        $items = $db->resultSet();
        
        $this->success([
            'invoice' => $inv,
            'items' => $items
        ]);
    }

    public function create() {
        $u = $this->requirePermission('pos.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $data['userId'] = $u['sub'];

        if (empty($data['items'])) {
            $this->error('No items provided for return', 400);
            return;
        }

        $result = $this->returnModel->create($data);
        if ($result) {
            if (isset($result['error'])) {
                $this->error('Model Error: ' . $result['error']);
                return;
            }
            $returnId = $result['id'];
            $returnNo = $result['return_no'];
            
            // Process Refund if requested
            if (!empty($data['refund'])) {
                $refData = $data['refund'];
                $refData['return_id'] = $returnId;
                $refData['invoice_id'] = $data['invoice_id'] ?? null;
                $refData['location_id'] = $data['location_id'] ?? 1;
                $refData['userId'] = $u['sub'];
                $this->refundModel->create($refData);
            }

            // Audit
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'create',
                'entity' => 'sales_return',
                'entity_id' => (int)$returnId,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'details' => json_encode(['invoice_id' => $data['invoice_id'] ?? null, 'total' => $data['total_amount'], 'return_no' => $returnNo]),
            ]);

            $this->success(['id' => $returnId, 'return_no' => $returnNo], 'Return processed successfully');
        } else {
            $this->error('Failed to process return');
        }
    }

    public function details($id = null) {
        $this->requirePermission('pos.read');
        $returnNo = $id ?? ($_GET['return_no'] ?? null);
        if (!$returnNo) {
            $this->error('Return Number required', 400);
            return;
        }

        $db = new Database();
        $db->query("
            SELECT sr.*, i.invoice_no, 
                   COALESCE(c_i.id, c_sr.id) as customer_id, 
                   COALESCE(c_i.name, c_sr.name) as customer_name,
                   (SELECT COUNT(*) FROM refunds WHERE return_id = sr.id) as refund_count
            FROM sales_returns sr
            LEFT JOIN invoices i ON sr.invoice_id = i.id
            LEFT JOIN customers c_i ON i.customer_id = c_i.id
            LEFT JOIN customers c_sr ON sr.customer_id = c_sr.id
            WHERE sr.return_no = :no
            LIMIT 1
        ");
        $db->bind(':no', $returnNo);
        $ret = $db->single();

        if (!$ret) {
            $this->error('Return not found', 404);
            return;
        }

        $items = $this->returnModel->getItems($ret->id);
        
        $this->success([
            'return' => $ret,
            'items' => $items,
            'is_refunded' => $ret->refund_count > 0
        ]);
    }

    public function print($id = null) {
        return $this->print_data($id);
    }

    public function print_data($id = null) {
        $this->requirePermission('pos.read');
        $db = new Database();
        
        // Handle ID from query string if not in URL segment
        $returnId = $id ?? ($_GET['id'] ?? null);
        
        if (!$returnId) {
            $this->error('No return ID provided', 400);
            return;
        }

        // 1. Get Return Record
        $db->query("
            SELECT sr.*, i.invoice_no, 
                   COALESCE(c_i.name, c_sr.name) as customer_name, 
                   sl.name as location_name
            FROM sales_returns sr
            LEFT JOIN invoices i ON sr.invoice_id = i.id
            LEFT JOIN customers c_i ON i.customer_id = c_i.id
            LEFT JOIN customers c_sr ON sr.customer_id = c_sr.id
            LEFT JOIN service_locations sl ON sr.location_id = sl.id
            WHERE sr.id = :id
        ");
        $db->bind(':id', $returnId);
        $return = $db->single();
        
        if (!$return) {
            $this->error('Return document not found', 404);
            return;
        }
        
        // 2. Get Items
        $db->query("SELECT * FROM sales_return_items WHERE return_id = :rid");
        $db->bind(':rid', $id);
        $items = $db->resultSet();
        
        $this->success([
            'return' => $return,
            'items' => $items
        ]);
    }
    public function refunds() {
        $this->requirePermission('pos.read');
        $filters = [
            'location_id' => $_GET['location_id'] ?? null,
            'invoice_no' => $_GET['invoice_no'] ?? null
        ];
        $refunds = $this->refundModel->getAll($filters);
        $this->success($refunds);
    }

    public function refund_print($id = null) {
        $this->requirePermission('pos.read');
        $db = new Database();
        
        $refundId = $id ?? ($_GET['id'] ?? null);
        if (!$refundId) {
            $this->error('Refund ID required', 400);
            return;
        }

        $db->query("
            SELECT r.*, sr.return_no, i.invoice_no, c.name as customer_name, sl.name as location_name
            FROM refunds r
            LEFT JOIN sales_returns sr ON r.return_id = sr.id
            JOIN invoices i ON r.invoice_id = i.id
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN service_locations sl ON i.location_id = sl.id
            WHERE r.id = :id
        ");
        $db->bind(':id', $refundId);
        $refund = $db->single();

        if (!$refund) {
            $this->error('Refund record not found', 404);
            return;
        }

        $this->success($refund);
    }
}
