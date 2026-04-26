<?php
/**
 * InventoryController - Specific inventory inquiries
 */
class InventoryController extends Controller {
    private $partModel;

    public function __construct() {
        $this->partModel = $this->model('Part');
    }

    /**
     * POST /api/inventory/stock-levels
     * Payload: { part_ids: [], location_id: 1 }
     */
    public function stock_levels() {
        $u = $this->requirePermission('parts.read');
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        
        $partIds = $input['part_ids'] ?? [];
        $locationId = (int)($input['location_id'] ?? 1);
        
        if (empty($partIds)) {
            $this->success([]);
        }

        $results = [];
        foreach ($partIds as $pid) {
            $stock = $this->partModel->getLocationStock((int)$pid, $locationId);
            $results[] = [
                'part_id' => (int)$pid,
                'available' => (float)($stock->available ?? 0),
                'on_hand' => (float)($stock->stock_quantity ?? 0)
            ];
        }

        $this->success($results);
    }
}
