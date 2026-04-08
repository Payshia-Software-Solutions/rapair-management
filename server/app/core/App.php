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
            if (method_exists($this->currentController, $url[0])) {
                $this->currentMethod = $url[0];
                array_shift($url);
            }
        }

        // 3. Get Params
        $this->params = $url ? array_values($url) : [];

        // 4. Call the method with params
        call_user_func_array([$this->currentController, $this->currentMethod], $this->params);
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
