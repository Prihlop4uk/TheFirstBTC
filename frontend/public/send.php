<?php
// ===== Приём заявок с формы и отправка в Telegram через Google Apps Script (Timeweb Proxy) =====

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

// --- Honeypot: защита от ботов ---
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

// --- Rate-limit по IP: не более 5 заявок за 10 минут ---
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

// --- Формируем текст сообщения ---
$esc = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$text  = "🎓 <b>Новая заявка на курс «Мой первый Биткоин Kids»</b>\n\n";
$text .= "👤 <b>Имя:</b> " . $esc($name) . "\n";
$text .= "📞 <b>Контакт:</b> " . $esc($contact) . "\n";
$text .= "🧒 <b>Возраст ребёнка:</b> " . ($age !== '' ? $esc($age) : '—') . "\n";
$text .= "🕒 " . gmdate('d.m.Y H:i') . " UTC";

// --- Отправка через Google Apps Script URL ---
$gasUrl = 'https://script.google.com/macros/s/AKfycbyykN4R8KjrSQ3_QEoEqy44zcXkr3en_gz1S8wCfgmcCtUPNrYrCmERmmMaf3locnj8xg/exec';

$payload = json_encode([
    'token'   => TELEGRAM_TOKEN,
    'chat_id' => TELEGRAM_CHAT_ID,
    'text'     => $text
], JSON_UNESCAPED_UNICODE);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $gasUrl,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    // Google Apps Script возвращает результат через защищённый редирект
    // на script.googleusercontent.com, поэтому редиректы нужно разрешить.
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 12,
    CURLOPT_CONNECTTIMEOUT => 5,

    // Проверяем сертификат и соответствие сертификата имени сервера.
    // Не отключайте эти параметры даже при использовании Google Apps Script.
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode === 200) {
    echo json_encode(['ok' => true, '_id' => 'sent']);
} else {
    error_log(sprintf(
        'Google Apps Script request failed: HTTP %d; cURL: %s',
        $httpCode,
        $curlError !== '' ? $curlError : 'no cURL error'
    ));

    http_response_code(502);
    echo json_encode([
        'detail' => 'Не удалось отправить заявку. Попробуйте позже.'
    ], JSON_UNESCAPED_UNICODE);
}
