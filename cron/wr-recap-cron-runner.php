<?php
/**
 * XAU AI Signal - WR Recap Cron Runner
 *
 * Dipanggil oleh cPanel Cron Job, contoh command:
 *   curl -s "https://xauaisignal.co-id.id/wr-recap-cron-runner.php?runner=genzrun2026&period=daily"   >/dev/null 2>&1
 *   curl -s "https://xauaisignal.co-id.id/wr-recap-cron-runner.php?runner=genzrun2026&period=weekly"  >/dev/null 2>&1
 *   curl -s "https://xauaisignal.co-id.id/wr-recap-cron-runner.php?runner=genzrun2026&period=monthly" >/dev/null 2>&1
 *
 * Jadwal yang disarankan (jam server WIB):
 *   daily   -> tiap hari       00:00
 *   weekly  -> tiap Senin      00:00
 *   monthly -> tiap tanggal 1  00:00
 *
 * Security:
 * - Runner URL wajib pakai token ?runner=
 * - Secret Cloudflare tidak dikirim di query URL publik, dikirim via header
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$endpoint = getenv('WR_RECAP_CRON_URL') ?: 'https://www.xauaisignal.online/api/wr-recap-cron';

// Secret ini HARUS sama dengan Cloudflare ENV: WR_RECAP_CRON_SECRET
$secret = getenv('WR_RECAP_CRON_SECRET') ?: 'genzxau2026';

// Token khusus untuk membuka file runner ini dari cron URL.
$runnerAccessToken = getenv('WR_RECAP_RUNNER_ACCESS_TOKEN') ?: 'genzrun2026';

$timeout = (int)(getenv('WR_RECAP_CRON_TIMEOUT_SEC') ?: 20);
$incomingRunnerToken = $_GET['runner'] ?? $_POST['runner'] ?? '';

if (!$runnerAccessToken || !hash_equals($runnerAccessToken, (string)$incomingRunnerToken)) {
  http_response_code(403);
  echo json_encode([
    'ok' => false,
    'error' => 'Forbidden. Runner token tidak valid.'
  ], JSON_PRETTY_PRINT);
  exit;
}

$period = $_GET['period'] ?? $_POST['period'] ?? 'daily';
if (!in_array($period, ['daily', 'weekly', 'monthly'], true)) {
  $period = 'daily';
}

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_TIMEOUT => $timeout,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-wr-recap-cron-secret: ' . $secret,
    'x-cron-runner: cpanel-wr-recap'
  ],
  CURLOPT_POSTFIELDS => json_encode(['period' => $period])
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo json_encode([
  'ok' => $httpCode >= 200 && $httpCode < 300,
  'period' => $period,
  'httpCode' => $httpCode,
  'error' => $error ?: null,
  'response' => json_decode($response, true) ?? $response
], JSON_PRETTY_PRINT);
