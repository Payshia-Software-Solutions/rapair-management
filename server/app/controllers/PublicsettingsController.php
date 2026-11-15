<?php
/**
 * Public Settings Controller
 * Provides public API access to storefront settings (Analytics, Pixel, IPG).
 */
class PublicsettingsController extends Controller {
    private $apiClientModel;
    private $settingModel;

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
        $this->settingModel = $this->model('SystemSetting');
    }

    private function handlePublicCors() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: X-API-Key, Content-Type');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            if (!empty($apiKey) && !empty($origin) && $this->apiClientModel->validate($apiKey, $origin)) {
                header('Access-Control-Allow-Origin: ' . $origin);
            } else {
                header('Access-Control-Allow-Origin: *');
            }
            http_response_code(204);
            exit;
        }
        if (!empty($origin) && !empty($apiKey) && $this->apiClientModel->validate($apiKey, $origin)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        } else {
            header('Access-Control-Allow-Origin: *');
        }
    }

    private function validatePublicApiKey() {
        $this->handlePublicCors();
        $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (empty($headerKey) || !$this->apiClientModel->validate($headerKey, $origin)) {
            $this->error('Unauthorized', 403);
        }
        return $this->apiClientModel->getByKey($headerKey);
    }

    /**
     * GET /api/publicsettings/storefront
     * Returns location-specific and global storefront settings.
     */
    public function storefront() {
        $client = $this->validatePublicApiKey();
        
        // ?market=au selects a market for multi-market keys; otherwise the key's own location.
        $resolved = MarketResolver::forRequest($this->apiClientModel);
        $market = $resolved['market'];
        $locationId = (int)$resolved['location_id'];
        if ($locationId <= 0) $this->error('Market or location is required', 400);

        $locationModel = $this->model('ServiceLocation');
        $location = $locationModel->getById($locationId);
        
        if (!$location) $this->error('Location not found', 404);

        // Global Settings
        $allSettings = $this->settingModel->getAll();
        
        // Filter only public settings
        $publicSettings = [
            // The merchant ID is saved per mode (sandbox / live); same lookup as PayHereHelper::prepareCheckout.
            'payhere_merchant_id' => ((int)($allSettings['payhere_is_sandbox'] ?? 1) === 1
                ? ($allSettings['payhere_merchant_id_sandbox'] ?? '')
                : ($allSettings['payhere_merchant_id_live'] ?? '')) ?: ($allSettings['payhere_merchant_id'] ?? ''),
            'payhere_is_sandbox' => (int)($allSettings['payhere_is_sandbox'] ?? 1) === 1,
            'currency_code' => $market ? (string)$market->currency_code : ($allSettings['currency_code'] ?? 'LKR'),
            'store_name' => $allSettings['store_name'] ?? $location->name,
            'contact_email' => $allSettings['contact_email'] ?? '',
            'contact_phone' => $allSettings['contact_phone'] ?? $location->phone,
        ];

        // Storefront payment options for this location (ERP > Storefront settings > Payments).
        require_once '../app/models/StorefrontSetting.php';
        $storefrontModel = new StorefrontSetting();
        $storefront = $storefrontModel->getAll($locationId);
        $on = fn($key, $default) => (string)($storefront[$key] ?? $default) === '1';
        $publicSettings['payments'] = [
            'payhere' => $on('payment_payhere_enabled', '1'),
            'cod' => $on('payment_cod_enabled', '1'),
            'bank_transfer' => $on('payment_bank_transfer_enabled', '1'),
            'mintpay' => $on('payment_mintpay_enabled', '0'),
            'stripe' => $on('payment_stripe_enabled', '0'),
            'koko' => $on('payment_koko_enabled', '0'),
        ];
        // Cart add-ons (ERP > Ecommerce settings > Packaging). Items come from publicitem?category_id=...
        $publicSettings['packaging'] = [
            'category_id' => (int)($storefront['packaging_category_id'] ?? 0),
            'gift_message' => [
                'enabled' => (string)($storefront['gift_message_enabled'] ?? '1') === '1',
                'item_id' => StorefrontSetting::giftCardItemId($storefront),
                'max_length' => max(1, (int)($storefront['gift_message_max_length'] ?? 120)),
                'brand_line' => (string)($storefront['gift_message_brand_line'] ?? ''),
            ],
        ];
        // Best sellers are chosen per market (ERP > Markets); a market without its own list uses the location's list.
        $publicSettings['homepage_best_seller_ids'] = ($market && isset($market->best_seller_ids) && $market->best_seller_ids !== null)
            ? StorefrontSetting::parseProductIdList((string)$market->best_seller_ids)
            : $storefrontModel->seedHomepageBestSellerIds($storefront, $locationId);

        // Website messages, edited in ERP > Storefront settings > Shipping.
        $publicSettings['delivery_note'] = (string)($storefront['delivery_note'] ?? '');
        $publicSettings['announcement_text'] = (string)($storefront['announcement_text'] ?? '');
        // Home page FAQ, edited in ERP > E-commerce > FAQ. null = never saved, so the website keeps its built-in list.
        $publicSettings['faq'] = array_key_exists('faq_items', $storefront) ? StorefrontSetting::faqItems($storefront) : null;
        // Shown to shoppers who choose bank transfer.
        $publicSettings['bank'] = [
            'bank_name' => (string)($storefront['bank_name'] ?? ''),
            'account_name' => (string)($storefront['bank_account_name'] ?? ''),
            'account_number' => (string)($storefront['bank_account_number'] ?? ''),
            'branch' => (string)($storefront['bank_branch'] ?? ''),
        ];

        $this->success([
            'location' => [
                'id' => (int)$location->id,
                'name' => (string)$location->name,
                'address' => (string)$location->address,
                'phone' => (string)$location->phone,
                'google_analytics_code' => (string)$location->google_analytics_code,
                'facebook_pixel_code' => (string)$location->facebook_pixel_code
            ],
            'market' => $market ? [
                'code' => (string)$market->code,
                'name' => (string)$market->name,
                'country_code' => (string)$market->country_code,
                'currency' => [
                    'code' => (string)$market->currency_code,
                    'symbol' => (string)($market->currency_symbol ?? $market->currency_code),
                    'decimals' => (int)($market->currency_decimals ?? 2),
                ],
                'locale' => (string)$market->locale,
                'language_code' => (string)$market->language_code,
                'checkout_mode' => (string)($market->checkout_mode ?? 'online'),
                'quote_message' => (string)($market->quote_message ?? ''),
            ] : null,
            'settings' => $publicSettings
        ]);
    }

    /**
     * POST /api/publicsettings/ai
     * AI assistant provider, model and key for the website server (never the browser).
     * Needs the API key AND the X-Server-Secret header matching the "Website connection secret"
     * saved in ERP > Storefront settings > AI Assistant.
     */
    public function ai() {
        $this->validatePublicApiKey();
        $resolved = MarketResolver::forRequest($this->apiClientModel);
        $locationId = (int)$resolved['location_id'];
        if ($locationId <= 0) $this->error('Market or location is required', 400);

        require_once '../app/models/StorefrontSetting.php';
        $model = new StorefrontSetting();
        $s = $model->getAll($locationId);
        // Fall back to the main location's AI settings when this location has none.
        if (empty($s['ai_server_secret']) && $locationId !== 1) $s = $model->getAll(1);

        $expected = (string)($s['ai_server_secret'] ?? '');
        $given = (string)($_SERVER['HTTP_X_SERVER_SECRET'] ?? '');
        if ($expected === '' || $given === '' || !hash_equals($expected, $given)) $this->error('Unauthorized', 403);

        $provider = in_array(($s['ai_provider'] ?? ''), ['gemini', 'claude', 'openai'], true) ? $s['ai_provider'] : 'gemini';
        $this->success([
            'enabled' => (string)($s['ai_enabled'] ?? '1') === '1',
            'provider' => $provider,
            'model' => (string)($s['ai_' . $provider . '_model'] ?? ''),
            'apiKey' => (string)($s['ai_' . $provider . '_key'] ?? ''),
        ]);
    }
}
