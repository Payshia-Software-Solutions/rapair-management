<?php
/**
 * SaasController
 * Public API to check SaaS configuration.
 */
class SaasController extends Controller {
    public function config() {
        $config = SaasHelper::getConfig();
        echo json_encode([
            'status' => 'success',
            'data' => $config
        ]);
    }

    public function sync() {
        $config = SaasHelper::syncConfig();
        echo json_encode([
            'status' => 'success',
            'data' => $config
        ]);
    }

    public function packages() {
        $packages = SaasHelper::getPackages();
        echo json_encode([
            'status' => 'success',
            'data' => $packages
        ]);
    }
}
