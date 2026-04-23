<?php
/**
 * Public Item Controller
 * Provides public API access to inventory items using API Key authentication.
 */
class PublicitemController extends Controller {
    private $itemModel;
    private $apiClientModel;

    public function __construct() {
        $this->itemModel = $this->model('Part');
        $this->apiClientModel = $this->model('ApiClient');
    }

    /**
     * Handles dynamic CORS based on multi-client domains.
     */
    private function handlePublicCors() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        
        // Basic preflight response - we'll let the actual request validation handle the logic
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: X-API-Key, Content-Type');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            // Check if origin is allowed for this key (if key provided)
            if (!empty($apiKey) && !empty($origin)) {
                if ($this->apiClientModel->validate($apiKey, $origin)) {
                    header('Access-Control-Allow-Origin: ' . $origin);
                    http_response_code(204);
                    exit;
                }
            }
            
            // Default preflight if no specific match
            header('Access-Control-Allow-Origin: *');
            http_response_code(204);
            exit;
        }

        // For actual requests, validate and set Origin header
        if (!empty($origin) && !empty($apiKey)) {
            if ($this->apiClientModel->validate($apiKey, $origin)) {
                header('Access-Control-Allow-Origin: ' . $origin);
            }
        } else {
            header('Access-Control-Allow-Origin: *');
        }
    }

    /**
     * Internal helper to validate the X-API-Key and its Domain.
     */
    private function validatePublicApiKey() {
        $this->handlePublicCors();

        $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (empty($headerKey)) {
            $this->error('API Key required', 401);
        }

        if (!$this->apiClientModel->validate($headerKey, $origin)) {
            $this->error('Access Denied: Invalid Key or unauthorized Domain', 403);
        }
    }

    /**
     * GET /api/public/inventory
     * Lists active products with sanitized data.
     */
    public function inventory() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
        }

        $this->validatePublicApiKey();

        // Fetch all active items
        $items = $this->itemModel->list();
        
        $sanitized = array_map(function($item) {
            return [
                'id' => (int)$item->id,
                'name' => (string)$item->part_name,
                'sku' => (string)$item->sku,
                'price' => (float)$item->price,
                'brand' => (string)($item->brand_name ?? 'Generic'),
                'item_type' => (string)$item->item_type,
                'is_in_stock' => (float)$item->stock_quantity > 0,
                'stock_qty' => (float)$item->stock_quantity,
                'image_url' => !empty($item->image_filename) ? '/uploads/parts/' . $item->image_filename : null,
                'category_ids' => $item->collection_ids ?? []
            ];
        }, array_filter($rows = $items, function($i) {
            return (int)$i->is_active === 1;
        }));

        $this->success(array_values($sanitized));
    }

    /**
     * GET /api/public/inventory/{id}
     * Returns detailed sanitized data for one product.
     */
    public function get($id) {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
        }

        $this->validatePublicApiKey();

        $item = $this->itemModel->getById($id);
        if (!$item || (int)$item->is_active === 0) {
            $this->error('Product not found', 404);
        }

        $sanitized = [
            'id' => (int)$item->id,
            'name' => (string)$item->part_name,
            'sku' => (string)$item->sku,
            'part_number' => (string)$item->part_number,
            'description' => (string)$item->part_name, // Fallback if no full description field
            'price' => (float)$item->price,
            'brand' => (string)($item->brand_name ?? 'Generic'),
            'item_type' => (string)$item->item_type,
            'unit' => (string)$item->unit,
            'is_in_stock' => (float)$item->stock_quantity > 0,
            'stock_qty' => (float)$item->stock_quantity,
            'image_url' => !empty($item->image_filename) ? '/uploads/parts/' . $item->image_filename : null,
            'collections' => array_map(function($c) {
                return ['id' => $c->id, 'name' => $c->name];
            }, $item->collections ?: [])
        ];

        $this->success($sanitized);
    }
}
