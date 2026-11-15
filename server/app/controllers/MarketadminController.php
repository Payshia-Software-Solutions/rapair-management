<?php
/**
 * Market admin: staff manage markets (countries), currencies and per-market fixed price lists.
 * Reuses the promotions.* permissions that guard the rest of the e-commerce admin.
 */
class MarketadminController extends Controller {
    private $marketModel;

    public function __construct() {
        $this->marketModel = $this->model('Market');
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    private function userId() {
        $u = $this->currentUser();
        return $u['sub'] ?? null;
    }

    // ---------- Markets ----------

    public function markets() {
        $this->requirePermission('promotions.read');
        $rows = $this->marketModel->listAll();
        $db = new Database();
        foreach ($rows as $m) {
            $db->query("SELECT COUNT(*) AS n FROM part_market_prices WHERE market_id = :m");
            $db->bind(':m', (int)$m->id);
            $m->priced_items = (int)$db->single()->n;
        }
        $this->success($rows);
    }

    public function locations() {
        $this->requirePermission('promotions.read');
        $db = new Database();
        $db->query("SELECT id, name FROM service_locations ORDER BY name");
        $this->success($db->resultSet());
    }

    public function save($id = 0) {
        $this->requirePermission('promotions.write');
        $d = $this->body();
        $id = (int)$id;

        $code = strtolower(trim((string)($d['code'] ?? '')));
        if (!preg_match('/^[a-z]{2}(?:-[a-z]{2})?$/', $code)) $this->error('Use a two-letter market code or a language-country code, such as en-jp.', 400);
        $name = trim((string)($d['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);
        $country = strtoupper(trim((string)($d['country_code'] ?? '')));
        if (!preg_match('/^[A-Z]{2}$/', $country)) $this->error('Country code must be 2 letters (ISO), e.g. AU', 400);
        $currency = strtoupper(trim((string)($d['currency_code'] ?? '')));
        if (!$this->marketModel->getCurrency($currency)) {
            require_once __DIR__ . '/../helpers/MarketSchema.php';
            MarketSchema::seedWorldCurrencies();
        }
        if (!$this->marketModel->getCurrency($currency)) $this->error('Unknown currency. Add it under Currencies first.', 400);
        $locationId = (int)($d['location_id'] ?? 0);
        if ($locationId <= 0) $this->error('ERP location is required', 400);

        $existing = $this->marketModel->getByCode($code);
        if ($existing && (int)$existing->id !== $id) $this->error('Another market already uses this code', 409);

        $stockLoc = !empty($d['stock_location_id']) ? (int)$d['stock_location_id'] : null;
        $isDefault = !empty($d['is_default']) ? 1 : 0;

        $db = new Database();
        if ($isDefault) {
            $db->query("UPDATE markets SET is_default = 0" . ($id ? " WHERE id <> :id" : ""));
            if ($id) $db->bind(':id', $id);
            $db->execute();
        }

        $params = [
            ':code' => $code, ':name' => $name, ':country' => $country, ':cur' => $currency,
            ':lang' => trim((string)($d['language_code'] ?? 'en')) ?: 'en',
            ':locale' => trim((string)($d['locale'] ?? 'en')) ?: 'en',
            ':loc' => $locationId, ':stock' => $stockLoc,
            ':pl' => array_key_exists('uses_price_list', $d) ? (int)!empty($d['uses_price_list']) : 1,
            ':def' => $isDefault,
            ':act' => array_key_exists('is_active', $d) ? (int)!empty($d['is_active']) : 1,
            ':sort' => (int)($d['sort_order'] ?? 0),
            ':mode' => (($d['checkout_mode'] ?? 'online') === 'quote') ? 'quote' : 'online',
            ':qemail' => trim((string)($d['quote_notify_email'] ?? '')) ?: null,
            ':qmsg' => trim((string)($d['quote_message'] ?? '')) ?: null,
            ':u' => $this->userId(),
        ];

        if ($id) {
            $db->query("UPDATE markets SET code=:code, name=:name, country_code=:country, currency_code=:cur, language_code=:lang,
                        locale=:locale, location_id=:loc, stock_location_id=:stock, uses_price_list=:pl, is_default=:def,
                        is_active=:act, sort_order=:sort, checkout_mode=:mode, quote_notify_email=:qemail, quote_message=:qmsg, updated_by=:u WHERE id=:id");
            $params[':id'] = $id;
        } else {
            $db->query("INSERT INTO markets (code,name,country_code,currency_code,language_code,locale,location_id,stock_location_id,uses_price_list,is_default,is_active,sort_order,checkout_mode,quote_notify_email,quote_message,created_by,updated_by)
                        VALUES (:code,:name,:country,:cur,:lang,:locale,:loc,:stock,:pl,:def,:act,:sort,:mode,:qemail,:qmsg,:u,:u)");
        }
        foreach ($params as $k => $v) $db->bind($k, $v);
        try {
            $db->execute();
        } catch (Exception $e) {
            $this->error($e->getMessage());
        }
        $newId = $id ?: (int)$db->lastInsertId();
        $this->success(['id' => $newId], 'Market saved');
    }

    public function delete($id = 0) {
        $this->requirePermission('promotions.write');
        $id = (int)$id;
        $market = $this->marketModel->getById($id);
        if (!$market) $this->error('Market not found', 404);
        $db = new Database();
        $db->query("SELECT COUNT(*) AS n FROM online_orders WHERE market_id = :m");
        $db->bind(':m', $id);
        if ((int)$db->single()->n > 0) $this->error('This market has orders. Deactivate it instead of deleting.', 409);
        $db->query("DELETE FROM part_market_prices WHERE market_id = :m");
        $db->bind(':m', $id);
        $db->execute();
        $db->query("DELETE FROM markets WHERE id = :m");
        $db->bind(':m', $id);
        $db->execute();
        $this->success(null, 'Market deleted');
    }

    // ---------- Currencies ----------

    public function currencies() {
        $this->requirePermission('promotions.read');
        require_once __DIR__ . '/../helpers/MarketSchema.php';
        MarketSchema::seedWorldCurrencies();
        header('Cache-Control: no-store');
        $db = new Database();
        $db->query("SELECT * FROM currencies ORDER BY code");
        $this->success($db->resultSet());
    }

    public function saveCurrency() {
        $this->requirePermission('promotions.write');
        $d = $this->body();
        $code = strtoupper(trim((string)($d['code'] ?? '')));
        if (!preg_match('/^[A-Z]{3}$/', $code)) $this->error('Currency code must be 3 letters (ISO 4217)', 400);
        $name = trim((string)($d['name'] ?? ''));
        $symbol = trim((string)($d['symbol'] ?? ''));
        if ($name === '' || $symbol === '') $this->error('Name and symbol are required', 400);
        $decimals = max(0, min(4, (int)($d['decimals'] ?? 2)));
        $rate = (float)($d['rate_to_base'] ?? 0);
        $active = array_key_exists('is_active', $d) ? (int)!empty($d['is_active']) : 1;

        $db = new Database();
        $db->query("INSERT INTO currencies (code,name,symbol,decimals,rate_to_base,is_active) VALUES (:c,:n,:s,:d,:r,:a)
                    ON DUPLICATE KEY UPDATE name=VALUES(name), symbol=VALUES(symbol), decimals=VALUES(decimals), rate_to_base=VALUES(rate_to_base), is_active=VALUES(is_active)");
        $db->bind(':c', $code); $db->bind(':n', $name); $db->bind(':s', $symbol);
        $db->bind(':d', $decimals); $db->bind(':r', $rate); $db->bind(':a', $active);
        $db->execute();
        $this->success(['code' => $code], 'Currency saved');
    }

    // ---------- Price lists ----------

    /** GET prices/{marketId}: every online item with its price in this market (blank = not sold there). */
    public function prices($marketId = 0) {
        $this->requirePermission('promotions.read');
        $market = $this->marketModel->getById((int)$marketId);
        if (!$market) $this->error('Market not found', 404);

        $db = new Database();
        $db->query("SELECT p.id, p.sku, p.part_name AS name, p.price AS base_price, pm.price AS market_price, pm.compare_at_price, pm.sale_from, pm.sale_to
                    FROM parts p
                    LEFT JOIN part_market_prices pm ON pm.part_id = p.id AND pm.market_id = :m
                    WHERE p.is_active = 1 AND p.is_online = 1
                    ORDER BY p.part_name");
        $db->bind(':m', (int)$marketId);
        $this->success(['market' => $market, 'items' => $db->resultSet()]);
    }

    /**
     * POST prices/{marketId}   body: {items:[{part_id|sku, price, compare_at_price?}], remove_blank?:bool}
     * Used by both the grid's Save and CSV import. A blank/null price removes the item from the market.
     */
    public function savePrices($marketId = 0) {
        $this->requirePermission('promotions.write');
        $market = $this->marketModel->getById((int)$marketId);
        if (!$market) $this->error('Market not found', 404);
        $d = $this->body();
        $items = $d['items'] ?? [];
        if (!is_array($items)) $this->error('items must be a list', 400);

        $dec = (int)($market->currency_decimals ?? 2);
        $db = new Database();
        $saved = 0; $removed = 0; $errors = [];

        foreach ($items as $i => $it) {
            $partId = (int)($it['part_id'] ?? 0);
            if (!$partId && !empty($it['sku'])) {
                $db->query("SELECT id FROM parts WHERE sku = :s LIMIT 1");
                $db->bind(':s', trim((string)$it['sku']));
                $row = $db->single();
                $partId = $row ? (int)$row->id : 0;
            }
            if (!$partId) { $errors[] = 'Row ' . ($i + 1) . ': item not found'; continue; }

            $price = $it['price'] ?? null;
            if ($price === null || $price === '') {
                $this->marketModel->deletePrice($market->id, $partId);
                $removed++;
                continue;
            }
            if (!is_numeric($price) || (float)$price < 0) { $errors[] = 'Row ' . ($i + 1) . ': invalid price'; continue; }
            $cmp = $it['compare_at_price'] ?? null;
            if ($cmp !== null && $cmp !== '' && !is_numeric($cmp)) { $errors[] = 'Row ' . ($i + 1) . ': invalid compare-at price'; continue; }

            $this->marketModel->setPrice($market->id, $partId, round((float)$price, $dec), $cmp, $this->userId(), $it['sale_from'] ?? null, $it['sale_to'] ?? null);
            $saved++;
        }
        $this->success(['saved' => $saved, 'removed' => $removed, 'errors' => $errors], "Saved $saved price(s)");
    }

    /**
     * GET /api/marketadmin/bestSellers/{id}
     * The market's homepage best sellers. Until a list is saved for the market, returns what its location shows today.
     */
    public function bestSellers($marketId = 0) {
        $this->requirePermission('promotions.read');
        $market = $this->marketModel->getById((int)$marketId);
        if (!$market) $this->error('Market not found', 404);

        require_once '../app/models/StorefrontSetting.php';
        $custom = isset($market->best_seller_ids) && $market->best_seller_ids !== null;
        if ($custom) {
            $ids = StorefrontSetting::parseProductIdList((string)$market->best_seller_ids);
        } else {
            $storefront = new StorefrontSetting();
            $ids = $storefront->seedHomepageBestSellerIds($storefront->getAll((int)$market->location_id), (int)$market->location_id);
        }
        $this->success(['ids' => $ids, 'custom' => $custom, 'location_id' => (int)$market->location_id]);
    }

    /** POST /api/marketadmin/saveBestSellers/{id}  body: { ids: [12, 7, ...] }  (an empty list hides the section) */
    public function saveBestSellers($marketId = 0) {
        $this->requirePermission('promotions.write');
        $market = $this->marketModel->getById((int)$marketId);
        if (!$market) $this->error('Market not found', 404);
        $d = $this->body();
        if (!isset($d['ids']) || !is_array($d['ids'])) $this->error('ids must be a list', 400);

        // Migrations only run when forced; make sure markets.best_seller_ids exists before the first save.
        require_once '../app/helpers/MarketSchema.php';
        MarketSchema::ensure(true);

        require_once '../app/models/StorefrontSetting.php';
        $ids = StorefrontSetting::parseProductIdList(implode(',', array_map('strval', $d['ids'])));
        $db = new Database();
        $db->query("UPDATE markets SET best_seller_ids = :ids, updated_by = :u WHERE id = :id");
        $db->bind(':ids', implode(',', $ids));
        $db->bind(':u', $this->userId());
        $db->bind(':id', (int)$market->id);
        $db->execute();

        $this->notifyWebsite(['settings']);
        $this->success(['ids' => $ids], 'Best sellers saved');
    }

    /** Ask the website to drop its cached storefront settings (best effort; never blocks the save). */
    private function notifyWebsite(array $tags) {
        if (!defined('WEBSITE_REVALIDATE_URL') || WEBSITE_REVALIDATE_URL === '' || !defined('WEBSITE_REVALIDATE_SECRET') || WEBSITE_REVALIDATE_SECRET === '') return;
        $ch = curl_init(WEBSITE_REVALIDATE_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['tags' => $tags]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . WEBSITE_REVALIDATE_SECRET],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);
        if (curl_exec($ch) === false) error_log('Website revalidate failed: ' . curl_error($ch));
        curl_close($ch);
    }
}
