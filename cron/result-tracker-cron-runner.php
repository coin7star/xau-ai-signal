<?php
/**
 * XAU AI Signal - Step 10U Auto Result Cron Runner
 *
 * Pasang file ini di PHP.ID cron / hosting PHP.
 * File ini HANYA memanggil Cloudflare endpoint /api/result-tracker-cron.
 * Harga real-time tetap berasal dari MT5/VPS live feed yang tersimpan di Firebase /xauusd/latest.
 * File ini TIDAK mengambil harga dari Bybit.
 */

header('Content-Type: application/json; charset=utf-8');

$endpoint = getenv('RESULT_TRACKER_CRON_URL') ?: 'https://www.xauaisignal.online/api/result-tracker-cron';
$secret = getenv('RESULT_TRACKER_CRON_SECRET') ?: '';
$timeout = (int)(getenv('RESULT_TRACKER_CRON_TIMEOUT_SEC') ?: 20);

if (!$secret) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'RESULT_TRACKER_CRON_SECRET belum diset di hosting PHP cron.',
    'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY'
  ], JSON_PRETTY_PRINT);
  exit;
}

$url = $endpoint . (strpos($endpoint, '?') === false ? '?' : '&') . 'token=' . rawurlencode($secret);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => $timeout,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_HTTPHEADER => [
    'Accept: application/json',
    'User-Agent: XAU-AI-Result-Cron/10U',
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
    'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY'
  ], JSON_PRETTY_PRINT);
  exit;
}

http_response_code($status > 0 ? $status : 200);
$response = json_decode($body, true);
if (json_last_error() === JSON_ERROR_NONE) {
  $response['phpCronRunner'] = 'OK';
  $response['dataSourceNote'] = 'Result memakai live feed MT5/VPS, bukan Bybit test feed.';
  echo json_encode($response, JSON_PRETTY_PRINT);
  exit;
}

echo json_encode([
  'ok' => $status >= 200 && $status < 300,
  'status' => $status,
  'raw' => $body,
  'phpCronRunner' => 'OK',
  'dataSource' => 'MT5_VPS_LIVE_FEED_ONLY'
], JSON_PRETTY_PRINT);
