<?php
/**
 * SaasController
 * Public API to check SaaS configuration.
 */
class SaasController extends Controller {
    public function config() {
        $config = SaasHelper::getConfig();
        $this->success($config);
    }

    public function sync() {
        $config = SaasHelper::syncConfig();
        $this->success($config);
    }

    public function packages() {
        $packages = SaasHelper::getPackages();
        $this->success($packages);
    }
}
