<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Services\ExchangeRateService;

class SettingsController extends Controller {
    
    private function checkAuth() {
        if (!isset($_SESSION['admin_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
        return true;
    }

    public function getExchangeRates() {
        if ($this->checkAuth() !== true) return;
        $rates = ExchangeRateService::getAll();
        $sources = ExchangeRateService::getSources();
        
        $db = new \App\Core\Database();
        $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'exchange_rate_source'");
        $activeSource = $db->single()->setting_value ?? 'exchangerate-api';

        return $this->json([
            'status' => 'success', 
            'data' => [
                'rates' => $rates,
                'sources' => $sources,
                'active_source' => $activeSource
            ]
        ]);
    }

    public function updateSyncSource() {
        if ($this->checkAuth() !== true) return;
        $data = json_decode(file_get_contents('php://input'), true);
        $source = $data['source'] ?? null;
        if (!$source) return $this->json(['status' => 'error', 'message' => 'Source required'], 400);

        if (ExchangeRateService::setSource($source)) {
            return $this->json(['status' => 'success', 'message' => 'Sync source updated']);
        }
        return $this->json(['status' => 'error', 'message' => 'Failed to update source'], 500);
    }

    public function updateExchangeRate() {
        if ($this->checkAuth() !== true) return;
        
        $data = json_decode(file_get_contents('php://input'), true);
        $code = $data['currency_code'] ?? null;
        $rate = $data['rate'] ?? null;

        if (!$code || !$rate) {
            return $this->json(['status' => 'error', 'message' => 'Code and Rate required'], 400);
        }

        if (ExchangeRateService::updateRate($code, $rate)) {
            return $this->json(['status' => 'success', 'message' => 'Rate updated']);
        }
        return $this->json(['status' => 'error', 'message' => 'Failed to update rate'], 500);
    }

    public function resetExchangeRate() {
        if ($this->checkAuth() !== true) return;
        $data = json_decode(file_get_contents('php://input'), true);
        $code = $data['currency_code'] ?? null;
        if (!$code) return $this->json(['status' => 'error', 'message' => 'Code required'], 400);

        if (ExchangeRateService::resetRate($code)) {
            // Force a sync to get the market rate immediately
            ExchangeRateService::getRates(true);
            return $this->json(['status' => 'success', 'message' => 'Rate reset to market']);
        }
        return $this->json(['status' => 'error', 'message' => 'Failed to reset rate'], 500);
    }

    public function previewSync() {
        if ($this->checkAuth() !== true) return;
        $summary = ExchangeRateService::previewSync();
        return $this->json(['status' => 'success', 'data' => $summary]);
    }

    public function applySync() {
        if ($this->checkAuth() !== true) return;
        $data = json_decode(file_get_contents('php://input'), true);
        $items = $data['items'] ?? [];
        
        $count = ExchangeRateService::applySync($items);
        return $this->json(['status' => 'success', 'message' => "Successfully applied $count rate updates"]);
    }

    public function getCompanyInfo() {
        if ($this->checkAuth() !== true) return;
        $db = new \App\Core\Database();
        $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'company_%'");
        $results = $db->resultSet();
        $settings = [];
        foreach ($results as $row) {
            $settings[$row->setting_key] = $row->setting_value;
        }
        return $this->json(['status' => 'success', 'data' => $settings]);
    }

    public function updateCompanyInfo() {
        if ($this->checkAuth() !== true) return;
        $data = json_decode(file_get_contents('php://input'), true);
        
        $db = new \App\Core\Database();
        foreach ($data as $key => $val) {
            if (strpos($key, 'company_') === 0) {
                $db->query("UPDATE saas_settings SET setting_value = :val WHERE setting_key = :key");
                $db->bind(':val', $val);
                $db->bind(':key', $key);
                $db->execute();
            }
        }
        return $this->json(['status' => 'success', 'message' => 'Company settings updated']);
    }
}
