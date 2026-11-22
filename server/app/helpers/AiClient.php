<?php
require_once __DIR__ . '/AiConfig.php';

/**
 * One chat call to whichever provider the company configured (AiConfig).
 * Raw HTTPS so all three providers share one small adapter and no SDKs are needed.
 *
 *   AiClient::chat($system, [['role' => 'user'|'assistant', 'content' => '...'], ...]) -> string
 *
 * Throws RuntimeException with a readable message on any failure.
 */
class AiClient {
    const TIMEOUT = 120;
    const MAX_TOKENS = 16000;

    public static function chat(string $system, array $messages): string {
        $cfg = AiConfig::active();
        if ($cfg['apiKey'] === '') {
            throw new RuntimeException('No API key is set for ' . ucfirst($cfg['provider']) . '. Add it in System Settings → AI.');
        }
        switch ($cfg['provider']) {
            case 'claude': return self::claude($cfg, $system, $messages);
            case 'openai': return self::openai($cfg, $system, $messages);
            default:       return self::gemini($cfg, $system, $messages);
        }
    }

    private static function post(string $url, array $headers, array $body, int $attempt = 0): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
            CURLOPT_POSTFIELDS => json_encode($body),
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException('Could not reach the AI provider: ' . $err);
        // Busy / rate limited: wait a moment and try once more.
        if (in_array($code, [429, 503, 529], true) && $attempt === 0) {
            usleep(1500000);
            return self::post($url, $headers, $body, 1);
        }
        $json = json_decode($raw, true);
        if ($code >= 400 || !is_array($json)) {
            $msg = $json['error']['message'] ?? (is_string($json['error'] ?? null) ? $json['error'] : substr((string)$raw, 0, 300));
            if (in_array($code, [429, 503, 529], true)) {
                throw new RuntimeException('The AI model is busy right now. Try again in a moment, or pick a different model in System Settings → AI.');
            }
            throw new RuntimeException("AI provider error ($code): $msg");
        }
        return $json;
    }

    // Anthropic Messages API. Current Claude models reject temperature, so none is sent;
    // thinking is left at the model default.
    private static function claude(array $cfg, string $system, array $messages): string {
        $res = self::post('https://api.anthropic.com/v1/messages', [
            'x-api-key: ' . $cfg['apiKey'],
            'anthropic-version: 2023-06-01',
        ], [
            'model' => $cfg['model'],
            'max_tokens' => self::MAX_TOKENS,
            'system' => $system,
            'messages' => array_map(fn($m) => ['role' => $m['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string)$m['content']], $messages),
        ]);
        if (($res['stop_reason'] ?? '') === 'refusal') {
            throw new RuntimeException('The model declined this request. Try rephrasing the question.');
        }
        $text = '';
        foreach ($res['content'] ?? [] as $block) {
            if (($block['type'] ?? '') === 'text') $text .= $block['text'];
        }
        return $text;
    }

    // OpenAI Chat Completions. Newer models only accept the default temperature, so none is sent.
    private static function openai(array $cfg, string $system, array $messages): string {
        $msgs = [['role' => 'system', 'content' => $system]];
        foreach ($messages as $m) $msgs[] = ['role' => $m['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string)$m['content']];
        $res = self::post('https://api.openai.com/v1/chat/completions', [
            'Authorization: Bearer ' . $cfg['apiKey'],
        ], ['model' => $cfg['model'], 'messages' => $msgs]);
        return (string)($res['choices'][0]['message']['content'] ?? '');
    }

    // Google Gemini generateContent. Key goes in a header, not the URL, so it never lands in logs.
    private static function gemini(array $cfg, string $system, array $messages): string {
        $contents = array_map(fn($m) => [
            'role' => $m['role'] === 'assistant' ? 'model' : 'user',
            'parts' => [['text' => (string)$m['content']]],
        ], $messages);
        $res = self::post(
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($cfg['model']) . ':generateContent',
            ['x-goog-api-key: ' . $cfg['apiKey']],
            ['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => $contents, 'generationConfig' => ['temperature' => 0.1]]
        );
        $text = '';
        foreach ($res['candidates'][0]['content']['parts'] ?? [] as $p) $text .= $p['text'] ?? '';
        if ($text === '' && !empty($res['promptFeedback']['blockReason'])) {
            throw new RuntimeException('The model blocked this request (' . $res['promptFeedback']['blockReason'] . ').');
        }
        return $text;
    }
}
