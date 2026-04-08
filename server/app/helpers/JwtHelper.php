<?php
/**
 * Minimal JWT (HS256) helper.
 * Keeps dependencies out of the PHP MVC project.
 */
class JwtHelper {
    private static function b64url_encode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64url_decode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode($payload, $secret) {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [];
        $segments[] = self::b64url_encode(json_encode($header));
        $segments[] = self::b64url_encode(json_encode($payload));
        $signing_input = implode('.', $segments);
        $signature = hash_hmac('sha256', $signing_input, $secret, true);
        $segments[] = self::b64url_encode($signature);
        return implode('.', $segments);
    }

    public static function decode($jwt, $secret) {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        [$headb64, $bodyb64, $sigb64] = $parts;

        $header = json_decode(self::b64url_decode($headb64), true);
        $payload = json_decode(self::b64url_decode($bodyb64), true);
        if (!is_array($header) || !is_array($payload)) {
            return null;
        }
        if (($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        $signing_input = $headb64 . '.' . $bodyb64;
        $expected = hash_hmac('sha256', $signing_input, $secret, true);
        $sig = self::b64url_decode($sigb64);

        if (!hash_equals($expected, $sig)) {
            return null;
        }

        $now = time();
        if (isset($payload['nbf']) && $now < (int)$payload['nbf']) {
            return null;
        }
        if (isset($payload['exp']) && $now >= (int)$payload['exp']) {
            return null;
        }

        return $payload;
    }
}

