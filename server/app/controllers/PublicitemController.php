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
     * GET /api/publicitem/inventory
     * Lists active products for a specific location.
     */
    public function inventory() {
        $this->handlePublicCors();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
        }

        $this->validatePublicApiKey();

        // Which market/location is this for? (?market=au for multi-market keys, otherwise the key's own location)
        $resolved = MarketResolver::forRequest($this->apiClientModel);
        $market = $resolved['market'];
        $locationId = $resolved['location_id'];
        if ($locationId <= 0) $this->error('Market or location is required', 400);
        // Availability can be read from another location (e.g. ship from the home warehouse).
        $stockLocationId = ($market && !empty($market->stock_location_id)) ? (int)$market->stock_location_id : $locationId;
        // Fixed price list: only items with a price in this market are sold, at that price.
        $priceMap = ($market && (int)$market->uses_price_list === 1) ? (new Market())->priceMap($market->id) : null;
        $currencyCode = $market ? (string)$market->currency_code : null;

        $collectionId = isset($_GET['collection_id']) ? (int)$_GET['collection_id'] : null;
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;

        // Fetch items for this location
        $items = $this->itemModel->listLocationBalances($stockLocationId);
        
        // Fetch taxes and tax_inclusive setting
        require_once '../app/models/Tax.php';
        require_once '../app/models/ServiceLocation.php';
        require_once '../app/models/StorefrontSetting.php';
        
        $taxModel = new Tax();
        $locModel = new ServiceLocation();
        $settingModel = new StorefrontSetting();
        
        $location = $locModel->getById($locationId);
        $taxIds = !empty($location->allowed_taxes_json) ? json_decode($location->allowed_taxes_json, true) : [];
        $taxes = $taxModel->getByIds($taxIds);
        $allSettings = $settingModel->getAll($locationId);
        $taxInclusive = ($allSettings['ecom_tax_inclusive'] ?? '0') === '1';
        
        $taxMultiplier = 0; // Cumulative multiplier. 1.0 means 0% tax.
        $currentMultiplier = 1.0;
        foreach ($taxes as $tax) {
            $rate = (float)$tax->rate_percent / 100;
            if (($tax->apply_on ?? 'base') === 'base_plus_previous') {
                $currentMultiplier *= (1 + $rate);
            } else {
                $taxMultiplier += $rate;
            }
        }
        $finalMultiplier = ($currentMultiplier - 1.0) + $taxMultiplier;
        // Total price = Base * (1 + finalMultiplier) if only additive.
        // Wait, the correct way to combine additive and compound:
        // Price = (Base * (1 + SumOfAdditive)) * (ProductOfCompound)
        
        $additiveRate = 0;
        $compoundMultiplier = 1.0;
        foreach ($taxes as $tax) {
            $rate = (float)$tax->rate_percent / 100;
            if (($tax->apply_on ?? 'base') === 'base_plus_previous') {
                $compoundMultiplier *= (1 + $rate);
            } else {
                $additiveRate += $rate;
            }
        }
        $totalMultiplier = ((1 + $additiveRate) * $compoundMultiplier) - 1;

        require_once '../app/models/PartAttribute.php';
        $attrModel = new PartAttribute();

        $contentUrl = defined('CONTENT_BASE_URL') ? CONTENT_BASE_URL : 'https://content-provider.payshia.com/service-center-system/';
        $itemsDir = defined('CONTENT_ITEMS_DIR') ? CONTENT_ITEMS_DIR : 'items';
        $imageBaseUrl = rtrim($contentUrl, '/') . '/' . trim($itemsDir, '/') . '/';

        $webOnly = ($_GET['channel'] ?? '') === 'web';
        $packagingCategory = (int)($allSettings['packaging_category_id'] ?? 0);
        $complimentaryIds = $webOnly ? StorefrontSetting::complimentaryPackagingIds($allSettings) : [];
        $sanitized = [];
        foreach ($items as $item) {
            $isOnline = (int)($item->is_online ?? 0) === 1;
            $isKiosk = ($item->kiosk_module ?? 'None') !== 'None';
            if (!$isOnline && ($webOnly || !$isKiosk)) continue;
            
            if ((int)$item->is_active !== 1) continue;

            // Optional collection filtering
            if ($collectionId !== null) {
                if (!in_array($collectionId, $item->collection_ids ?? [])) continue;
            }

            // Packaging add-ons (retail bags, gift boxes) are only listed when the cart asks for their category.
            $isPackaging = $packagingCategory > 0 && (int)$item->item_category_id === $packagingCategory;
            if ($categoryId === null && $isPackaging) continue;

            // Optional category filtering
            if ($categoryId !== null && (int)$item->item_category_id !== $categoryId) continue;

            $sanitizedGallery = array_map(function($img) use ($imageBaseUrl) {
                return [
                    'id' => (int)$img->id,
                    'image_url' => $imageBaseUrl . $img->filename,
                    'label' => (string)($img->label ?? '')
                ];
            }, $item->gallery ?: []);

            $compareAt = null;
            $discountType = (string)($item->discount_type ?? 'None');
            $discountValue = (float)($item->discount_value ?? 0);
            if ($priceMap !== null) {
                // Not priced in this market = not sold here.
                if (!isset($priceMap[(int)$item->id])) continue;
                [$displayPrice, $compareAt] = $priceMap[(int)$item->id];
                // The list price is final: it already follows the market's tax convention, and the LKR-based
                // item discount does not apply (use compare_at_price for a struck-through price).
                $discountType = 'None';
                $discountValue = 0.0;
            } else {
                $displayPrice = (float)$item->price;
                if ($taxInclusive) {
                    $displayPrice = $displayPrice * (1 + $totalMultiplier);
                }
            }

            if ($isPackaging && in_array((int)$item->id, $complimentaryIds, true)) {
                $displayPrice = 0.0;
                $compareAt = null;
                $discountType = 'None';
                $discountValue = 0.0;
            }

            $sanitized[] = [
                'id' => (int)$item->id,
                'name' => (string)$item->part_name,
                'slug' => (string)($item->slug ?? ''),
                'sku' => (string)$item->sku,
                'price' => $displayPrice,
                'compare_at_price' => $compareAt,
                'currency_code' => $currencyCode,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'brand' => (string)($item->brand_name ?? 'Generic'),
                'description' => (string)($item->public_description ?? ''),
                'item_type' => (string)$item->item_type,
                'is_in_stock' => (float)$item->stock_quantity > 0,
                'stock_qty' => (float)$item->stock_quantity,
                'image_url' => !empty($item->image_filename) ? $imageBaseUrl . $item->image_filename : null,
                'gallery' => $sanitizedGallery,
                'category_ids' => $item->collection_ids ?? [],
                // Item classification (section > department > category), used by storefront filters.
                'section_id' => isset($item->item_section_id) ? (int)$item->item_section_id : null,
                'section_name' => (string)($item->section_name ?? ''),
                'department_id' => isset($item->item_department_id) ? (int)$item->item_department_id : null,
                'department_name' => (string)($item->department_name ?? ''),
                'item_category_id' => isset($item->item_category_id) ? (int)$item->item_category_id : null,
                'item_category_name' => (string)($item->category_name ?? ''),
                'kiosk_module' => (string)($item->kiosk_module ?? 'None'),
                'attributes' => $attrModel->getPartAttributesGrouped($item->id)
            ];
        }

        $this->success(array_values($sanitized));
    }

    /**
     * GET /api/publicitem/get/{id}
     * Returns detailed sanitized data for one product.
     */
    public function get($id) {
        $this->handlePublicCors();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
        }

        $this->validatePublicApiKey();

        $resolved = MarketResolver::forRequest($this->apiClientModel);
        $market = $resolved['market'];
        $locationId = $resolved['location_id'];
        $stockLocationId = ($market && !empty($market->stock_location_id)) ? (int)$market->stock_location_id : $locationId;
        $marketPrice = null; // [price, compare_at] when this market uses a fixed price list

        if (is_numeric($id)) {
            $item = $this->itemModel->getById($id);
        } else {
            $item = $this->itemModel->getBySlug($id);
        }
        
        $isOnline = (int)($item->is_online ?? 0) === 1;
        $isKiosk = ($item->kiosk_module ?? 'None') !== 'None';
        
        $webOnly = ($_GET['channel'] ?? '') === 'web';
        if (!$item || (int)$item->is_active !== 1 || (!$isOnline && ($webOnly || !$isKiosk))) {
            $this->error('Product not found', 404);
        }

        // Fixed price list: an item without a price in this market is not sold there.
        if ($market && (int)$market->uses_price_list === 1) {
            $marketPrice = (new Market())->getPrice($market->id, $item->id);
            if ($marketPrice === null) $this->error('Product not found', 404);
        }

        // If location provided, get location-specific stock
        if ($stockLocationId > 0) {
            $balance = $this->itemModel->getLocationStock($item->id, $stockLocationId);
            $item->stock_quantity = $balance ? $balance->available : 0;
        }

        $contentUrl = defined('CONTENT_BASE_URL') ? CONTENT_BASE_URL : 'https://content-provider.payshia.com/service-center-system/';
        $itemsDir = defined('CONTENT_ITEMS_DIR') ? CONTENT_ITEMS_DIR : 'items';
        $imageBaseUrl = rtrim($contentUrl, '/') . '/' . trim($itemsDir, '/') . '/';

        require_once '../app/models/PartAttribute.php';
        $attrModel = new PartAttribute();
        
        require_once '../app/models/KioskContent.php';
        $kioskContentModel = new KioskContent();
        $kioskContent = $kioskContentModel->getByPartId($item->id);

        require_once '../app/models/Tax.php';
        require_once '../app/models/ServiceLocation.php';
        require_once '../app/models/StorefrontSetting.php';
        
        $taxModel = new Tax();
        $locModel = new ServiceLocation();
        $settingModel = new StorefrontSetting();
        
        $location = $locModel->getById($locationId);
        $taxIds = !empty($location->allowed_taxes_json) ? json_decode($location->allowed_taxes_json, true) : [];
        $taxes = $taxModel->getByIds($taxIds);
        $allSettings = $settingModel->getAll($locationId);
        $taxInclusive = ($allSettings['ecom_tax_inclusive'] ?? '0') === '1';
        
        $additiveRate = 0;
        $compoundMultiplier = 1.0;
        foreach ($taxes as $tax) {
            $rate = (float)$tax->rate_percent / 100;
            if (($tax->apply_on ?? 'base') === 'base_plus_previous') {
                $compoundMultiplier *= (1 + $rate);
            } else {
                $additiveRate += $rate;
            }
        }
        $totalMultiplier = ((1 + $additiveRate) * $compoundMultiplier) - 1;

        $compareAt = null;
        $discountType = (string)($item->discount_type ?? 'None');
        $discountValue = (float)($item->discount_value ?? 0);
        if ($marketPrice !== null) {
            [$displayPrice, $compareAt] = $marketPrice;
            $discountType = 'None';
            $discountValue = 0.0;
        } else {
            $displayPrice = (float)$item->price;
            if ($taxInclusive) {
                $displayPrice = $displayPrice * (1 + $totalMultiplier);
            }
        }

        $sanitized = [
            'id' => (int)$item->id,
            'name' => (string)$item->part_name,
            'slug' => (string)($item->slug ?? ''),
            'sku' => (string)$item->sku,
            'part_number' => (string)$item->part_number,
            'description' => (string)$item->public_description, 
            'price' => $displayPrice,
            'compare_at_price' => $compareAt,
            'currency_code' => $market ? (string)$market->currency_code : null,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'brand' => (string)($item->brand_name ?? 'Generic'),
            'description' => (string)($item->public_description ?? ''),
            'item_type' => (string)$item->item_type,
            'unit' => (string)$item->unit,
            'is_in_stock' => (float)$item->stock_quantity > 0,
            'stock_qty' => (float)$item->stock_quantity,
            'image_url' => !empty($item->image_filename) ? $imageBaseUrl . $item->image_filename : null,
            'gallery' => array_map(function($img) use ($imageBaseUrl) {
                return [
                    'id' => (int)$img->id,
                    'image_url' => $imageBaseUrl . $img->filename,
                    'label' => (string)$img->label
                ];
            }, $item->gallery ?: []),
            'collections' => array_map(function($c) {
                return ['id' => $c->id, 'name' => $c->name];
            }, $item->collections ?: []),
            'kiosk_module' => (string)($item->kiosk_module ?? 'None'),
            'kiosk_content_html' => $kioskContent ? (string)$kioskContent->content_html : null,
            'kiosk_video_url' => $kioskContent ? (string)$kioskContent->video_url : null,
            'attributes' => $attrModel->getPartAttributesGrouped($item->id)
        ];

        $this->success($sanitized);
    }

    /**
     * GET /api/publicitem/sync_slugs
     * Maintenance tool to initialize slugs for existing products.
     */
    public function sync_slugs() {
        $this->handlePublicCors();
        $count = $this->itemModel->syncSlugs();
        $this->success(['count' => $count], "Slugs synced");
    }
}
