<?php
/**
 * Company-wide AI model setting, shared by Business Intelligence and the e-commerce assistant.
 *
 * Stored in system_settings:
 *   ai_provider           gemini | claude | openai
 *   ai_<provider>_key     API key (never sent to browsers; masked on read)
 *   ai_<provider>_model   model id (blank = provider default below)
 *
 * Older installs kept these per location in storefront_settings (E-commerce > Settings > AI).
 * The first read copies location 1's values here once, so nobody has to re-enter keys.
 */
class AiConfig {
    const PROVIDERS = ['gemini', 'claude', 'openai'];
    const SECRET_KEYS = ['ai_gemini_key', 'ai_claude_key', 'ai_openai_key'];
    const DEFAULT_MODELS = [
        'gemini' => 'gemini-3.5-flash-lite',
        'claude' => 'claude-opus-5-5',
        'openai' => 'gpt-5-mini',
    ];
    const MASK = '••••••••';

    private static function db() {
        return new Database();
    }

    /** All ai_* system settings, migrating from storefront location 1 on first use. */
    public static function raw(): array {
        $db = self::db();
        $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'ai\\_%'");
        $out = [];
        foreach ($db->resultSet() ?: [] as $r) $out[$r->setting_key] = (string)$r->setting_value;

        if (!isset($out['ai_provider'])) {
            $out = self::migrateFromStorefront() ?: $out;
        }
        return $out;
    }

    private static function migrateFromStorefront(): array {
        $db = self::db();
        try {
            $db->query("SELECT `key`, `value` FROM storefront_settings WHERE location_id = 1 AND `key` IN
                ('ai_provider','ai_gemini_key','ai_claude_key','ai_openai_key','ai_gemini_model','ai_claude_model','ai_openai_model')");
            $rows = $db->resultSet() ?: [];
        } catch (Exception $e) {
            $rows = [];
        }
        $vals = ['ai_provider' => 'gemini'];
        foreach ($rows as $r) $vals[$r->key] = (string)$r->value;
        foreach ($vals as $k => $v) self::save($k, $v);
        return $vals;
    }

    public static function save(string $key, string $value): void {
        $db = self::db();
        $db->query("INSERT INTO system_settings (setting_key, setting_value) VALUES (:k, :v)
                    ON DUPLICATE KEY UPDATE setting_value = :v2");
        $db->bind(':k', $key);
        $db->bind(':v', $value);
        $db->bind(':v2', $value);
        $db->execute();
    }

    /** The active provider, model and key. */
    public static function active(): array {
        $s = self::raw();
        $provider = in_array($s['ai_provider'] ?? '', self::PROVIDERS, true) ? $s['ai_provider'] : 'gemini';
        $model = trim((string)($s["ai_{$provider}_model"] ?? ''));
        return [
            'provider' => $provider,
            'model' => $model !== '' ? $model : self::DEFAULT_MODELS[$provider],
            'apiKey' => (string)($s["ai_{$provider}_key"] ?? ''),
        ];
    }

    /** Settings safe to show an admin: keys replaced by a mask plus the last 4 characters. */
    public static function forDisplay(): array {
        $s = self::raw();
        foreach (self::SECRET_KEYS as $k) {
            $v = (string)($s[$k] ?? '');
            $s[$k] = $v === '' ? '' : self::MASK . substr($v, -4);
        }
        $s['ai_provider'] = in_array($s['ai_provider'] ?? '', self::PROVIDERS, true) ? $s['ai_provider'] : 'gemini';
        return $s;
    }

    /** True when a submitted value is the unchanged mask (keep the stored key). */
    public static function isMasked($value): bool {
        return is_string($value) && strpos($value, self::MASK) === 0;
    }
}
