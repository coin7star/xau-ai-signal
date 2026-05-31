<?php
/**
 * XAU AI Signal - Step 10U1 Secure Auto Result Cron Runner
 *
 * Dipanggil oleh cPanel/PHP.ID Cron via URL:
 * curl -s "https://xauaisignal.co-id.id/result-tracker-cron-runner.php?runner=genzrun2026" >/dev/null 2>&1
 *
 * Security:
 * - Runner URL wajib pakai token ?runner=
 * - Secret Cloudflare tidak dikirim di query URL publik
 * - Request ke Cloudflare memakai POST + header x-result-cron-secret
 * - Harga result tetap dari MT5/VPS live feed, bukan Bybit
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$endpoint = getenv('RESULT_TRACKER_CRON_URL') ?: 'https://www.xauaisignal.online/api/result-tracker-cron';

// Secret ini HARUS sama dengan Cloudflare ENV: RESULT_TRACKER_CRON_SECRET
$secret = getenv('RESULT_TRACKER_CRON_SECRET') ?: 'genzxau2026';

// Token khusus untuk membuka file runner ini dari cron URL.
// Boleh diganti, tapi samakan juga di command cron bagian ?runner=...
$runnerAccessToken = getenv('RESULT_TRACKER_RUNNER_ACCESS_TOKEN') ?: 'genzrun2026';

$timeout = (int)(getenv('RESULT_TRACKER_CRON_TIMEOUT_SEC') ?: 20);
$incomingRunnerToken = $_GET['runner'] ?? $_POST['runner'] ?? '';

if (!$runnerAccessToken || !hash_equals($runnerAccessToken, (string)$incomingRunnerToken)) {
  http_response_code(403);
  echo json_encode([
    'ok' => false,
    'error' => 'Forbidden. Runner token tidak valid.',
    'security' => 'RUNNER_TOKEN_REQUIRED',
    'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY',
    'bybitUsed' => false
  ], JSON_PRETTY_PRINT);
  exit;
}

if (!$secret) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'RESULT_TRACKER_CRON_SECRET belum diset.',
    'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY',
    'bybitUsed' => false
  ], JSON_PRETTY_PRINT);
  exit;
}

$payload = json_encode([
  'runner' => 'PHP_ID_CRON_RUNNER_SECURE',
  'source' => 'MT5_VPS_LIVE_FEED_ONLY'
]);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_TIMEOUT => $timeout,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_FOLLOWLOCATION => false,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2,
  CURLOPT_HTTPHEADER => [
    'Accept: application/json',
    'Content-Type: application/json',
    'User-Agent: XAU-AI-Result-Cron/10U1-Secure',
    'x-cron-runner: PHP_ID_CRON_RUNNER_SECURE',
    'x-result-cron-secret: ' . $secret,
  ],
]);

$body = curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($errno) {
  http_response_code(502);
  echo json_encode([
    'ok' => false,
    'error' => 'Cron gagal memanggil Cloudflare endpoint.',
    'curlError' => $error,
    'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY',
    'bybitUsed' => false
  ], JSON_PRETTY_PRINT);
  exit;
}

http_response_code($status > 0 ? $status : 200);
$response = json_decode($body, true);

if (json_last_error() === JSON_ERROR_NONE) {
  echo json_encode([
    'ok' => !empty($response['ok']),
    'runner' => 'PHP_ID_CRON_RUNNER_SECURE',
    'source' => 'MT5_VPS_LIVE_FEED_ONLY',
    'bybitUsed' => false,
    'httpCode' => $status,
    'security' => 'POST_HEADER_SECRET_AND_RUNNER_TOKEN',
    'cloudflareResponse' => $response
  ], JSON_PRETTY_PRINT);
  exit;
}

echo json_encode([
  'ok' => $status >= 200 && $status < 300,
  'runner' => 'PHP_ID_CRON_RUNNER_SECURE',
  'source' => 'MT5_VPS_LIVE_FEED_ONLY',
  'bybitUsed' => false,
  'httpCode' => $status,
  'raw' => substr((string)$body, 0, 800),
  'security' => 'POST_HEADER_SECRET_AND_RUNNER_TOKEN'
], JSON_PRETTY_PRINT);
