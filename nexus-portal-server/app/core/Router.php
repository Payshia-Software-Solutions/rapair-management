<?php
namespace App\Core;

class Router {
    protected $routes = [];
    protected $params = [];

    public function add($route, $params = [], $method = 'GET') {
        // Convert the route to a regular expression: escape forward slashes
        $route = preg_replace('/\//', '\\/', $route);
        // Convert variables e.g. {id}
        $route = preg_replace('/\{([a-z]+)\}/', '(?P<\1>[a-z0-9-]+)', $route);
        // Add start and end delimiters and case insensitive flag
        $route = '/^' . $route . '$/i';
        
        $this->routes[$route] = [
            'params' => $params,
            'method' => strtoupper($method)
        ];
    }

    public function match($url, $method) {
        foreach ($this->routes as $route => $data) {
            if (preg_match($route, $url, $matches) && $method === $data['method']) {
                $params = $data['params'];
                foreach ($matches as $key => $match) {
                    if (is_string($key)) {
                        $params[$key] = $match;
                    }
                }
                $this->params = $params;
                return true;
            }
        }
        return false;
    }

    public function dispatch($url, $method) {
        $url = $this->removeQueryStringVariables($url);

        if ($this->match($url, $method)) {
            $controller = $this->params['controller'];
            $controller = $this->convertToStudlyCaps($controller);
            $controller = "App\Controllers\\$controller";

            if (class_exists($controller)) {
                $controller_object = new $controller($this->params);
                $action = $this->params['action'];
                $action = $this->convertToCamelCase($action);

                if (is_callable([$controller_object, $action])) {
                    $controller_object->$action();
                } else {
                    $this->error(404, "Method $action in controller $controller not found");
                }
            } else {
                $this->error(404, "Controller class $controller not found");
            }
        } else {
            $this->error(404, "No route matched for URL: $url ($method)");
        }
    }

    protected function convertToStudlyCaps($string) {
        return str_replace(' ', '', ucwords(str_replace('-', ' ', $string)));
    }

    protected function convertToCamelCase($string) {
        return lcfirst($this->convertToStudlyCaps($string));
    }

    protected function removeQueryStringVariables($url) {
        if ($url != '') {
            $parts = explode('&', $url, 2);
            if (strpos($parts[0], '=') === false) {
                $url = $parts[0];
            } else {
                $url = '';
            }
        }
        return $url;
    }

    protected function error($code, $message) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(['error' => $message]);
        exit;
    }
}
