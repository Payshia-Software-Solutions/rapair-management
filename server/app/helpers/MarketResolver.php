<?php
/**
 * MarketResolver
 * Decides which ERP location and market a public (API key) request is for.
 *
 *  - ?market=au        : the market with that code, if the key is allowed to use it
 *                        (the key is flagged all_markets, or the market uses the key's own location).
 *  - no market given   : the key's own location, and the active market bound to it (if any),
 *                        or the legacy ?location_id= parameter for keys without a location.
 *
 * A key that is not flagged all_markets can never reach another location, whatever the request says.
 */
class MarketResolver {
    public static function apiKey() {
        return $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
    }

    /**
     * @return array{client: ?object, location_id: int, market: ?object}
     */
    public static function forRequest($apiClientModel, $marketModel = null, $marketCode = null) {
        $client = $apiClientModel->getByKey(self::apiKey());
        $marketModel = $marketModel ?: new Market();
        $code = $marketCode !== null ? $marketCode : ($_GET['market'] ?? '');
        $clientLocation = (int)($client->location_id ?? 0);
        $allMarkets = (int)($client->all_markets ?? 0) === 1;

        if ($code !== '' && $code !== null) {
            $market = $marketModel->getByCode($code);
            if ($market && (int)$market->is_active === 1 && ($allMarkets || (int)$market->location_id === $clientLocation)) {
                return ['client' => $client, 'location_id' => (int)$market->location_id, 'market' => $market];
            }
            // Unknown or not allowed: behave as if the market does not exist.
            return ['client' => $client, 'location_id' => 0, 'market' => null];
        }

        if ($clientLocation > 0) {
            return ['client' => $client, 'location_id' => $clientLocation, 'market' => $marketModel->getByLocation($clientLocation)];
        }

        $requested = isset($_GET['location_id']) ? (int)$_GET['location_id'] : 0;
        return ['client' => $client, 'location_id' => $requested, 'market' => $requested > 0 ? $marketModel->getByLocation($requested) : null];
    }

    /** Markets a key may offer in its country selector. */
    public static function allowedMarkets($client, $marketModel = null) {
        $marketModel = $marketModel ?: new Market();
        $all = $marketModel->listActive();
        if ((int)($client->all_markets ?? 0) === 1) return $all;
        $loc = (int)($client->location_id ?? 0);
        return array_values(array_filter($all, function ($m) use ($loc) { return (int)$m->location_id === $loc; }));
    }
}
