<?php
/**
 * StorefrontNotifier
 * Tells the connected websites (API clients that have a refresh URL) that their cached storefront
 * data changed, so edits show up at once instead of after the website's cache expires.
 *
 * Each website gets POST <revalidate_url> with "Authorization: Bearer <its secret>" and {"tags":[...]}.
 * Best effort: a slow or failing website never blocks the save.
 */
class StorefrontNotifier {
    const TIMEOUT = 5;

    // ---------------------------------------------------------------- secrets at rest

    private static function key() {
        $base = defined('TENANCY_MASTER_KEY') && defined('TENANT_SLUG') ? TENANCY_MASTER_KEY . ':' . TENANT_SLUG : (defined('JWT_SECRET') && JWT_SECRET !== '' ? JWT_SECRET : null);
        if ($base === null) {
            throw new RuntimeException('StorefrontNotifier: no JWT_SECRET or tenancy key configured');
        }
        return hash('sha256', 'storefront-site:' . $base, true);
    }

    public static function seal($plain) {
        $iv = random_bytes(12);
        $tag = '';
        $ct = openssl_encrypt((string)$plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return 'v1:' . base64_encode($iv . $tag . $ct);
    }

    public static function unseal($enc) {
        if (!is_string($enc) || strpos($enc, 'v1:') !== 0) return '';
        $raw = base64_decode(substr($enc, 3), true);
        if ($raw === false || strlen($raw) < 29) return '';
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $plain === false ? '' : $plain;
    }

    // ---------------------------------------------------------------- URL safety

    /**
     * Null when the URL is fine, otherwise why not. The server calls this address, so on the shared
     * deployment private and internal addresses are refused (one workspace must not probe the network).
     */
    public static function urlProblem($url) {
        $p = parse_url((string)$url);
        if (!$p || empty($p['host']) || !in_array(strtolower($p['scheme'] ?? ''), ['http', 'https'], true)) {
            return 'Enter a full address starting with http:// or https://';
        }
        if (class_exists('Tenancy', false) && Tenancy::enabled()) {
            if (strtolower($p['scheme']) !== 'https') return 'Use an https:// address.';
            $ips = filter_var($p['host'], FILTER_VALIDATE_IP) ? [$p['host']] : (array)@gethostbynamel($p['host']);
            if (!$ips) return 'That address could not be found.';
            foreach ($ips as $ip) {
                if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return 'That address points to a private network and cannot be used.';
                }
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- sending

    private static function post($url, $secret, array $tags) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['tags' => $tags]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $secret],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        return $ch;
    }

    /** Sends one site a refresh request and reports what happened (used by the "Test" button). */
    public static function test($url, $secret) {
        $ch = self::post($url, $secret, ['settings']);
        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = $res === false ? curl_error($ch) : null;
        curl_close($ch);
        return ['ok' => $err === null && $code >= 200 && $code < 300, 'http_code' => $code, 'error' => $err];
    }

    /**
     * Refreshes every active website that has a refresh URL, all at once.
     * $locationId limits it to websites of that location (websites with no location always get it).
     */
    public static function revalidate(array $tags, $locationId = null) {
        $sites = [];
        try {
            require_once __DIR__ . '/ApiClientsSchema.php';
            $db = new Database();
            $db->query("SELECT client_name, revalidate_url, revalidate_secret, location_id FROM api_clients
                        WHERE is_active = 1 AND revalidate_url IS NOT NULL AND revalidate_url <> ''");
            foreach ($db->resultSet() as $c) {
                if ($locationId !== null && $c->location_id !== null && (int)$c->location_id !== (int)$locationId) continue;
                $secret = self::unseal($c->revalidate_secret);
                if ($secret !== '') $sites[] = [$c->client_name, $c->revalidate_url, $secret];
            }
        } catch (Throwable $e) {
            // Table or columns not there yet on this install: fall through to the old setting
        }

        // Single-client installs that still use the config constants keep working.
        // The shared deployment never uses them: they would ping one website for every workspace.
        $shared = class_exists('Tenancy', false) && Tenancy::enabled();
        if (!$sites && !$shared && defined('WEBSITE_REVALIDATE_URL') && WEBSITE_REVALIDATE_URL !== ''
            && defined('WEBSITE_REVALIDATE_SECRET') && WEBSITE_REVALIDATE_SECRET !== '') {
            $sites[] = ['website', WEBSITE_REVALIDATE_URL, WEBSITE_REVALIDATE_SECRET];
        }
        if (!$sites) return;

        $mh = curl_multi_init();
        $handles = [];
        foreach ($sites as [$name, $url, $secret]) {
            $ch = self::post($url, $secret, $tags);
            curl_multi_add_handle($mh, $ch);
            $handles[$name] = $ch;
        }
        do {
            $status = curl_multi_exec($mh, $running);
            if ($running) curl_multi_select($mh, 1.0);
        } while ($running && $status === CURLM_OK);
        foreach ($handles as $name => $ch) {
            $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($code < 200 || $code >= 300) error_log("Website refresh failed for '$name' (HTTP $code): " . curl_error($ch));
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);
    }
}
