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

        // 1. Look for Controller
        if (!empty($url)) {
            $controllerName = ucwords($url[0]) . 'Controller';
            if (file_exists('../app/controllers/' . $controllerName . '.php')) {
                $this->currentController = $controllerName;
                array_shift($url);
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
