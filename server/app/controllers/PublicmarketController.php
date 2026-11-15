<?php
/**
 * Public Market Controller
 * Lists the markets (countries) a storefront can offer, so the website's country selector,
 * currency formatting and language follow the ERP data with no code change per country.
 */
class PublicmarketController extends Controller {
    private $apiClientModel;
    private $marketModel;

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
        $this->marketModel = $this->model('Market');
    }

    private function handlePublicCors() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $apiKey = MarketResolver::apiKey();
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
        } elseif (empty($origin)) {
            header('Access-Control-Allow-Origin: *');
        }
    }

    /**
     * GET /api/publicmarket/list
     */
    public function list() {
        $this->handlePublicCors();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);

        $key = MarketResolver::apiKey();
        if (empty($key)) $this->error('API Key required', 401);
        if (!$this->apiClientModel->validate($key, $_SERVER['HTTP_ORIGIN'] ?? '')) {
            $this->error('Access Denied: Invalid Key or unauthorized Domain', 403);
        }

        $client = $this->apiClientModel->getByKey($key);
        $markets = MarketResolver::allowedMarkets($client, $this->marketModel);

        $out = array_map(function ($m) {
            return [
                'code' => (string)$m->code,
                'name' => (string)$m->name,
                'country_code' => (string)$m->country_code,
                'currency' => [
                    'code' => (string)$m->currency_code,
                    'symbol' => (string)($m->currency_symbol ?? $m->currency_code),
                    'decimals' => (int)($m->currency_decimals ?? 2),
                ],
                'language_code' => (string)$m->language_code,
                'locale' => (string)$m->locale,
                'is_default' => (int)$m->is_default === 1,
                'uses_price_list' => (int)$m->uses_price_list === 1,
                'checkout_mode' => (string)($m->checkout_mode ?? 'online'),
                'quote_message' => (string)($m->quote_message ?? ''),
            ];
        }, $markets);

        $this->success($out);
    }
}
