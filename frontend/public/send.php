<?php
// ===== Приём заявок с формы и отправка в Telegram (для Timeweb / любого PHP-хостинга) =====
// Токен и chat_id берутся из config.php (он НЕ хранится в Git — создайте его на сервере).

header('Content-Type: application/json; charset=utf-8');

// Разрешаем только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['detail' => 'Method not allowed']);
    exit;
}

// --- Читаем JSON или обычную форму ---
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

$name    = trim((string)($data['name'] ?? ''));
$contact = trim((string)($data['contact'] ?? ''));
$age     = trim((string)($data['age'] ?? ''));
$website = trim((string)($data['website'] ?? '')); // honeypot

// --- Honeypot: если заполнено скрытое поле — это бот. Делаем вид, что всё ок. ---
if ($website !== '') {
    echo json_encode(['ok' => true, '_id' => 'ignored']);
    exit;
}

// --- Ограничение длины ---
$name    = mb_substr($name, 0, 120);
$contact = mb_substr($contact, 0, 200);
$age     = mb_substr($age, 0, 40);

// --- Валидация ---
if ($name === '' || $contact === '') {
    http_response_code(400);
    echo json_encode(['detail' => 'Имя и контакт обязательны']);
    exit;
}

// --- Простой rate-limit по IP: не более 5 заявок за 10 минут (файловый) ---
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ip = trim(explode(',', $ip)[0]);
$rlFile = sys_get_temp_dir() . '/btc_leads_rl_' . md5($ip) . '.json';
$now = time();
$window = 600;
$maxReq = 5;
$hits = [];
if (is_file($rlFile)) {
    $decoded = json_decode((string)file_get_contents($rlFile), true);
    if (is_array($decoded)) $hits = $decoded;
}
$hits = array_values(array_filter($hits, fn($t) => ($now - (int)$t) < $window));
if (count($hits) >= $maxReq) {
    http_response_code(429);
    echo json_encode(['detail' => 'Слишком много заявок. Попробуйте позже.']);
    exit;
}
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

// --- Загружаем настройки Telegram ---
$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['detail' => 'Не настроен config.php на сервере']);
    exit;
}
require $configPath; // определяет TELEGRAM_TOKEN и TELEGRAM_CHAT_ID

if (!defined('TELEGRAM_TOKEN') || !defined('TELEGRAM_CHAT_ID') || TELEGRAM_TOKEN === '' || TELEGRAM_CHAT_ID === '') {
    http_response_code(500);
    echo json_encode(['detail' => 'Telegram не настроен']);
    exit;
}

// --- Формируем сообщение ---
$esc = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$text  = "🎓 <b>Новая заявка на курс «Мой первый Биткоин Kids»</b>\n\n";
$text .= "👤 <b>Имя:</b> " . $esc($name) . "\n";
$text .= "📞 <b>Контакт:</b> " . $esc($contact) . "\n";
$text .= "🧒 <b>Возраст ребёнка:</b> " . ($age !== '' ? $esc($age) : '—') . "\n";
$text .= "🕒 " . gmdate('d.m.Y H:i') . " UTC";

// --- Отправляем в Telegram ---
$url = 'https://api.telegram.org/bot' . TELEGRAM_TOKEN . '/sendMessage';
$payload = http_build_query([
    'chat_id' => TELEGRAM_CHAT_ID,
    'text' => $text,
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => 'true',
]);

$ok = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $ok = ($code === 200);
} else {
    // Fallback без cURL
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $payload,
        'timeout' => 10,
    ]]);
    $resp = @file_get_contents($url, false, $ctx);
    $ok = ($resp !== false);
}

if (!$ok) {
    http_response_code(502);
    echo json_encode(['detail' => 'Не удалось отправить в Telegram']);
    exit;
}

echo json_encode(['ok' => true, '_id' => 'sent']);
