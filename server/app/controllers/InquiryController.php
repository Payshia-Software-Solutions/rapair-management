<?php
/**
 * Inquiry Controller
 */
class InquiryController extends Controller {
    private $inquiryModel;

    public function __construct() {
        $this->inquiryModel = $this->model('Inquiry');
    }

    /**
     * GET /api/inquiry
     */
    public function index() {
        $this->requirePermission('crm.inquiries.view');
        $filters = $_GET;
        $inquiries = $this->inquiryModel->getAll($filters);
        $this->success($inquiries);
    }

    /**
     * GET /api/inquiry/details/:id
     */
    public function details($id) {
        $this->requirePermission('crm.inquiries.view');
        $inquiry = $this->inquiryModel->getById($id);
        if (!$inquiry) {
            $this->error('Inquiry not found', 404);
        }
        $this->success($inquiry);
    }

    /**
     * POST /api/inquiry/create
     */
    public function create() {
        $u = $this->requirePermission('crm.inquiries.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['customer_name'])) {
            $this->error('Invalid input. Customer name is required.', 400);
        }

        $data['userId'] = $u['sub'];
        $inquiryId = $this->inquiryModel->create($data);

        if ($inquiryId) {
            $this->success(['id' => $inquiryId], 'Inquiry created successfully');
        } else {
            $this->error('Failed to create inquiry');
        }
    }

    /**
     * PUT /api/inquiry/update/:id
     */
    public function update($id) {
        $u = $this->requirePermission('crm.inquiries.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['customer_name'])) {
            $this->error('Invalid input. Customer name is required.', 400);
        }

        $data['userId'] = $u['sub'];
        if ($this->inquiryModel->update($id, $data)) {
            $this->success([], 'Inquiry updated successfully');
        } else {
            $this->error('Failed to update inquiry');
        }
    }

    /**
     * DELETE /api/inquiry/delete/:id
     */
    public function delete($id) {
        $this->requirePermission('crm.inquiries.delete');
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
            $this->error('Method Not Allowed', 405);
        }

        if ($this->inquiryModel->delete($id)) {
            $this->success([], 'Inquiry deleted successfully');
        } else {
            $this->error('Failed to delete inquiry');
        }
    }

    /**
     * GET /api/inquiry/sources
     */
    public function sources() {
        file_put_contents('../debug_api.log', "Sources called\n", FILE_APPEND);
        $sources = ['Direct', 'Website', 'Social Media', 'Referral', 'Exhibition', 'Other'];
        $this->success($sources);
    }

    /**
     * GET /api/inquiry/types
     */
    public function types() {
        file_put_contents('../debug_api.log', "Types called\n", FILE_APPEND);
        $types = ['General', 'Export', 'Banquet Booking', 'Room Booking', 'Service', 'Parts', 'Repair', 'Other'];
        $this->success($types);
    }

    /**
     * POST /api/inquiry/add_log/:id
     */
    public function add_log($id) {
        $u = $this->requirePermission('crm.inquiries.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['action'])) {
            $this->error('Action is required', 400);
        }

        if ($this->inquiryModel->addLog($id, $data['action'], $data['notes'] ?? '', $u['sub'])) {
            $this->success([], 'Log added successfully');
        } else {
            $this->error('Failed to add log');
        }
    }

    /**
     * POST /api/inquiry/convert/:id
     */
    public function convert($id) {
        $u = $this->requirePermission('crm.inquiries.manage');
        $data = json_decode(file_get_contents('php://input'), true);
        $type = $data['target_type'] ?? ''; 

        $inquiry = $this->inquiryModel->getById($id);
        if (!$inquiry) $this->error('Inquiry not found', 404);

        $targetId = $data['target_id'] ?? null;

        try {
            if (!$targetId) {
                if ($type === 'Export Costing') {
                    $shippingModel = $this->model('ShippingCostingSheet');
                    $products = [];
                    foreach ($inquiry->items as $item) {
                        if ($item->item_id) {
                            $products[] = [
                                'part_id' => $item->item_id,
                                'quantity' => $item->quantity,
                                'unit_cost' => $item->unit_price,
                                'profit_margin' => 10,
                                'packing_type' => 'Carton'
                            ];
                        }
                    }

                    $sheetData = [
                        'customer_id' => $inquiry->customer_id,
                        'reference_number' => $inquiry->inquiry_number,
                        'status' => 'Draft',
                        'product_items' => $products
                    ];

                    $targetId = $shippingModel->create($sheetData, $u['sub']);
                } 
                else if ($type === 'Quote') {
                    $quoteModel = $this->model('Quotation');
                    $quoteData = [
                        'customer_id' => $inquiry->customer_id,
                        'customer_name' => $inquiry->customer_name,
                        'phone' => $inquiry->phone,
                        'email' => $inquiry->email,
                        'reference' => $inquiry->inquiry_number,
                        'notes' => $inquiry->requirements,
                        'items' => array_map(function($item) {
                            return [
                                'item_id' => $item->item_id,
                                'description' => $item->description,
                                'quantity' => $item->quantity,
                                'unit_price' => $item->unit_price
                            ];
                        }, $inquiry->items)
                    ];
                    $targetId = $quoteModel->create($quoteData, $u['sub']);
                }
                else {
                    // Default simulation if no model logic yet
                    $targetId = rand(1000, 9999);
                }
            }

            if ($targetId) {
                if ($this->inquiryModel->updateConvertedTo($id, $type, $targetId)) {
                    $this->inquiryModel->addLog($id, "Converted to $type", "Linked to $type ID: $targetId", $u['sub']);
                    $this->success(['target_id' => $targetId], "Inquiry converted to $type successfully");
                } else {
                    $this->error('Inquiry status update failed');
                }
            } else {
                $this->error("Failed to create $type record");
            }
        } catch (Exception $e) {
            $this->error('Conversion Error: ' . $e->getMessage());
        }
    }

    public function unlink($id) {
        $u = $this->requirePermission('crm.inquiries.manage');
        if ($this->inquiryModel->unlinkConvertedTo($id)) {
            $this->inquiryModel->addLog($id, "Unlinked", "Document link removed and status reverted to Qualified", $u['sub']);
            $this->success([], "Inquiry unlinked successfully");
        } else {
            $this->error('Unlink failed');
        }
    }
}
