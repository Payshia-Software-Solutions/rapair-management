<?php
/**
 * Creates tenant databases and database users on the hosting platform.
 *   cpanel -> cPanel UAPI with an API token (shared hosting)
 *   mysql  -> direct MySQL admin account (VPS, Coolify, managed MySQL)
 * Chosen by TENANCY_DB_DRIVER in config.php.
 */
interface DatabaseHost {
    /** Prefix the platform forces on names (cPanel: "<cpaneluser>_"), '' otherwise. */
    public function prefix();
    public function createDatabase($name);
    /** Creates the user, or sets its password if it already exists. */
    public function createUser($user, $password);
    public function grantAll($user, $database);
    public function dropDatabase($name);
    public function dropUser($user);
}

class DatabaseHostFactory {
    public static function make() {
        $driver = defined('TENANCY_DB_DRIVER') ? TENANCY_DB_DRIVER : 'mysql';
        if ($driver === 'cpanel') return new CpanelDatabaseHost();
        if ($driver === 'mysql') return new MysqlDatabaseHost();
        throw new Exception("Unknown TENANCY_DB_DRIVER '$driver' (use cpanel or mysql)");
    }
}

class CpanelDatabaseHost implements DatabaseHost {
    private $url, $user, $token;

    public function __construct() {
        foreach (['TENANCY_CPANEL_URL', 'TENANCY_CPANEL_USER', 'TENANCY_CPANEL_TOKEN'] as $c) {
            if (!defined($c) || constant($c) === '') throw new Exception("$c is not set in config.php");
        }
        $this->url = rtrim(TENANCY_CPANEL_URL, '/');
        $this->user = TENANCY_CPANEL_USER;
        $this->token = TENANCY_CPANEL_TOKEN;
    }

    public function prefix() { return $this->user . '_'; }

    private function call($module, $function, array $params) {
        $ch = curl_init($this->url . "/execute/$module/$function?" . http_build_query($params));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => ['Authorization: cpanel ' . $this->user . ':' . $this->token],
        ]);
        $body = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false) throw new Exception("cPanel $module::$function: $err");
        $res = json_decode($body, true);
        if (!is_array($res)) throw new Exception("cPanel $module::$function: unexpected reply (HTTP $code)");
        if ((int)($res['status'] ?? 0) !== 1) {
            $msg = implode('; ', (array)($res['errors'] ?? ['unknown error']));
            throw new Exception("cPanel $module::$function: $msg");
        }
        return $res['data'] ?? null;
    }

    private static function alreadyExists(Exception $e) {
        return (bool)preg_match('/already exists|exists already/i', $e->getMessage());
    }

    public function createDatabase($name) {
        try { $this->call('Mysql', 'create_database', ['name' => $name]); }
        catch (Exception $e) { if (!self::alreadyExists($e)) throw $e; }
    }

    public function createUser($user, $password) {
        try { $this->call('Mysql', 'create_user', ['name' => $user, 'password' => $password]); }
        catch (Exception $e) {
            if (!self::alreadyExists($e)) throw $e;
            $this->call('Mysql', 'set_password', ['user' => $user, 'password' => $password]);
        }
    }

    public function grantAll($user, $database) {
        $this->call('Mysql', 'set_privileges_on_database', ['user' => $user, 'database' => $database, 'privileges' => 'ALL PRIVILEGES']);
    }

    public function dropDatabase($name) { $this->call('Mysql', 'delete_database', ['name' => $name]); }
    public function dropUser($user) { $this->call('Mysql', 'delete_user', ['name' => $user]); }
}

class MysqlDatabaseHost implements DatabaseHost {
    private $pdo;

    public function __construct() {
        foreach (['TENANCY_DB_ADMIN_USER', 'TENANCY_DB_ADMIN_PASS'] as $c) {
            if (!defined($c)) throw new Exception("$c is not set in config.php");
        }
        $host = defined('TENANCY_DB_ADMIN_HOST') ? TENANCY_DB_ADMIN_HOST : 'localhost';
        $this->pdo = new PDO("mysql:host=$host;charset=utf8mb4", TENANCY_DB_ADMIN_USER, TENANCY_DB_ADMIN_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    public function prefix() { return ''; }

    /** Host part of tenant DB users ('localhost' when the app and MySQL share a server, '%' in Docker/Coolify). */
    private function userHost() { return defined('TENANCY_DB_USER_HOST') ? TENANCY_DB_USER_HOST : 'localhost'; }

    private static function ident($name) {
        if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $name)) throw new Exception("Unsafe database identifier '$name'");
        return '`' . $name . '`';
    }

    public function createDatabase($name) {
        $this->pdo->exec("CREATE DATABASE IF NOT EXISTS " . self::ident($name) . " CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    }

    public function createUser($user, $password) {
        self::ident($user);
        $u = $this->pdo->quote($user) . '@' . $this->pdo->quote($this->userHost());
        $p = $this->pdo->quote($password);
        $this->pdo->exec("CREATE USER IF NOT EXISTS $u IDENTIFIED BY $p");
        $this->pdo->exec("ALTER USER $u IDENTIFIED BY $p");
    }

    public function grantAll($user, $database) {
        self::ident($user);
        $u = $this->pdo->quote($user) . '@' . $this->pdo->quote($this->userHost());
        $this->pdo->exec("GRANT ALL PRIVILEGES ON " . self::ident($database) . ".* TO $u");
    }

    public function dropDatabase($name) { $this->pdo->exec("DROP DATABASE IF EXISTS " . self::ident($name)); }

    public function dropUser($user) {
        self::ident($user);
        $this->pdo->exec("DROP USER IF EXISTS " . $this->pdo->quote($user) . '@' . $this->pdo->quote($this->userHost()));
    }
}
