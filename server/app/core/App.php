<?php
/**
 * App Class (Router)
 * Maps URLs to Controllers and Methods
 */

class App {
    protected $currentController = 'PagesController'; // Default
    protected $currentMethod = 'index';    // Default
    protected $params = [];

    public function __construct() {
        $url = $this->getUrl();

        // Check if the URL starts with 'api' and shift it
        if (!empty($url) && $url[0] === 'api') {
            array_shift($url);
        }

        $this->enforceTrialWriteLock($url);

        // 1. Look for Controller
        if (!empty($url)) {
            // Try normalized CamelCase (e.g. production-order -> ProductionOrderController)
            $controllerPart = str_replace('-', ' ', $url[0]);
            $controllerPart = ucwords($controllerPart);
            $controllerPart = str_replace(' ', '', $controllerPart);
            $controllerName = $controllerPart . 'Controller';

            if (file_exists('../app/controllers/' . $controllerName . '.php')) {
                $this->currentController = $controllerName;
                array_shift($url);
            } else {
                // Fallback to literal ucwords (original behavior)
                $controllerName = ucwords($url[0]) . 'Controller';
                if (file_exists('../app/controllers/' . $controllerName . '.php')) {
                    $this->currentController = $controllerName;
                    array_shift($url);
                }
            }
        }

        // Require the controller
        require_once '../app/controllers/' . $this->currentController . '.php';

        // Instantiate controller
        $this->currentController = new $this->currentController;

        // 2. Look for Method
        if (!empty($url)) {
            $methodName = str_replace('-', '_', $url[0]);
            if (method_exists($this->currentController, $methodName)) {
                $this->currentMethod = $methodName;
                array_shift($url);
            } else {
                // Method was provided but doesn't exist - return 404 instead of falling back to index
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => 'Method ' . $url[0] . ' (normalized to ' . $methodName . ') not found in controller ' . get_class($this->currentController)
                ]);
                exit;
            }
        }

        // 3. Get Params
        $this->params = $url ? array_values($url) : [];

        // 4. Call the method with params
        if (method_exists($this->currentController, $this->currentMethod)) {
            call_user_func_array([$this->currentController, $this->currentMethod], $this->params);
        } else {
            // Handle method not found
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'Method ' . $this->currentMethod . ' not found in controller ' . get_class($this->currentController)
            ]);
            exit;
        }
    }

    /**
     * Trial ended: the workspace stays readable and staff can still sign in, but every write
     * is refused (402 trial_ended) until the package is upgraded. Login and the SaaS
     * license/package endpoints stay open so the upgrade itself can be done.
     */
    private function enforceTrialWriteLock($url) {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) return;
        $segment = strtolower((string)($url[0] ?? ''));
        if (in_array($segment, ['auth', 'saas'], true)) return;

        require_once __DIR__ . '/../helpers/SaasHelper.php';
        if (!SaasHelper::trialEnded()) return;

        http_response_code(402);
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'code' => 'trial_ended',
            'message' => 'Your free trial has ended, so changes are disabled. Upgrade your package or contact your administrator to continue.',
        ]);
        exit;
    }

    public function getUrl() {
        if (isset($_GET['url'])) {
            $url = rtrim($_GET['url'], '/');
            $url = filter_var($url, FILTER_SANITIZE_URL);
            $url = explode('/', $url);
            return $url;
        }
        return [];
    }
}
