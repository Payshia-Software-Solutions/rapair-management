<?php
namespace App\Services;

class ExchangeRateService {
    private static $sources = [
        'exchangerate-api' => 'https://api.exchangerate-api.com/v4/latest/USD',
        'frankfurter'      => 'https://api.frankfurter.app/latest?from=USD',
        'exchangerate-host' => 'https://api.exchangerate.host/latest?base=USD'
    ];

    public static function previewSync() {
        $db = new \App\Core\Database();
        
        // Get active source from settings
        $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'exchange_rate_source'");
        $sourceKey = $db->single()->setting_value ?? 'exchangerate-api';
        $apiUrl = self::$sources[$sourceKey] ?? self::$sources['exchangerate-api'];

        // 1. Get current rates
        $db->query("SELECT * FROM saas_exchange_rates");
        $dbRates = $db->resultSet();
        $currentRates = [];
        $manualCurrencies = [];
        foreach ($dbRates as $row) {
            $currentRates[$row->currency_code] = $row->rate;
            if ($row->is_manual) $manualCurrencies[] = $row->currency_code;
        }

        $comparison = [];

        // 2. Fetch from API
        try {
            $ctx = stream_context_create(['http' => ['timeout' => 5]]);
            $response = @file_get_contents($apiUrl, false, $ctx);
            if ($response) {
                $apiData = json_decode($response, true);
                $newRates = $apiData['rates'] ?? [];
                if (!empty($newRates)) {
                    foreach (['LKR', 'EUR', 'GBP', 'USD'] as $code) {
                        if (isset($newRates[$code])) {
                            $oldRate = $currentRates[$code] ?? 0;
                            $newRate = $newRates[$code];
                            $isManual = in_array($code, $manualCurrencies);
                            
                            $comparison[] = [
                                'code' => $code,
                                'old' => $oldRate,
                                'new' => $newRate,
                                'status' => $isManual ? 'Manual Override' : ($oldRate == $newRate ? 'No Change' : 'Updated'),
                                'is_manual' => $isManual
                            ];
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            error_log("Sync Error: " . $e->getMessage());
        }

        return $comparison;
    }

    public static function getRates($force = false) {
        $db = new \App\Core\Database();
        
        $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'exchange_rate_source'");
        $sourceKey = $db->single()->setting_value ?? 'exchangerate-api';
        $apiUrl = self::$sources[$sourceKey] ?? self::$sources['exchangerate-api'];

        $db->query("SELECT * FROM saas_exchange_rates");
        $dbRates = $db->resultSet();
        $rates = [];
        $manualCurrencies = [];
        foreach ($dbRates as $row) {
            $rates[$row->currency_code] = $row->rate;
            if ($row->is_manual) $manualCurrencies[] = $row->currency_code;
        }

        $lastUpdate = count($dbRates) > 0 ? strtotime($dbRates[0]->updated_at) : 0;
        if ($force || (time() - $lastUpdate > 86400)) {
            try {
                $ctx = stream_context_create(['http' => ['timeout' => 5]]);
                $response = @file_get_contents($apiUrl, false, $ctx);
                if ($response) {
                    $apiData = json_decode($response, true);
                    $newRates = $apiData['rates'] ?? [];
                    if (!empty($newRates)) {
                        foreach ($newRates as $code => $rate) {
                            if (in_array($code, ['LKR', 'EUR', 'GBP', 'USD'])) {
                                if (!in_array($code, $manualCurrencies)) {
                                    $db->query("UPDATE saas_exchange_rates SET rate = :rate, is_manual = 0 WHERE currency_code = :code");
                                    $db->bind(':rate', $rate);
                                    $db->bind(':code', $code);
                                    $db->execute();
                                    $rates[$code] = $rate;
                                }
                            }
                        }
                    }
                }
            } catch (\Exception $e) {}
        }
        return $rates;
    }

    public static function applySync($items) {
        $db = new \App\Core\Database();
        $count = 0;
        foreach ($items as $item) {
            // Update if there's a difference, regardless of manual status (user confirmed)
            if (isset($item['new']) && $item['new'] != $item['old']) {
                $db->query("UPDATE saas_exchange_rates SET rate = :rate, is_manual = 0 WHERE currency_code = :code");
                $db->bind(':rate', $item['new']);
                $db->bind(':code', $item['code']);
                if ($db->execute()) $count++;
            }
        }
        return $count;
    }

    public static function getSources() {
        return array_keys(self::$sources);
    }

    public static function setSource($source) {
        $db = new \App\Core\Database();
        $db->query("UPDATE saas_settings SET setting_value = :val WHERE setting_key = 'exchange_rate_source'");
        $db->bind(':val', $source);
        return $db->execute();
    }

    public static function updateRate($code, $rate) {
        $db = new \App\Core\Database();
        $db->query("UPDATE saas_exchange_rates SET rate = :rate, is_manual = 1 WHERE currency_code = :code");
        $db->bind(':rate', $rate);
        $db->bind(':code', $code);
        return $db->execute();
    }

    public static function resetRate($code) {
        $db = new \App\Core\Database();
        $db->query("UPDATE saas_exchange_rates SET is_manual = 0 WHERE currency_code = :code");
        $db->bind(':code', $code);
        return $db->execute();
    }

    public static function getAll() {
        $db = new \App\Core\Database();
        $db->query("SELECT * FROM saas_exchange_rates ORDER BY currency_code ASC");
        return $db->resultSet();
    }
}
