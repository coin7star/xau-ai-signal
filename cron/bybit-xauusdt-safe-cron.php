<?php
/**
 * XAU AI Signal - Step 10G Bybit Rate Limit Safe Cron
 *
 * Upload file ini ke PHP.ID / hosting cron, lalu panggil via cron setiap 60 detik:
 * https://domain-cron-kamu.com/bybit-xauusdt-safe-cron.php?token=ISI_BYBIT_CRON_SECRET
 *
 * Fitur aman:
 * - Cek cooldown dari Firebase sebelum hit Bybit.
 * - Tahan request kalau data masih fresh.
 * - Backoff otomatis saat HTTP 429 / retCode 10006.
 * - Tidak menghapus latest lama saat Bybit error.
 * - Menyimpan status, latest, dan error ke path test:
 *   /bybit_test/xauusdt/latest
 *   /bybit_test/xauusdt/status
 *   /bybit_test/xauusdt/error
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

date_default_timezone_set('UTC');

$config = [
  'firebaseDatabaseUrl' => rtrim(envv('FIREBASE_DATABASE_URL', 'https://xauusd-signal-web-default-rtdb.firebaseio.com'), '/'),
  'cronSecret' => envv('BYBIT_CRON_SECRET', ''),
  'symbol' => envv('BYBIT_SYMBOL', 'XAUUSDT'),
  'category' => envv('BYBIT_CATEGORY', 'linear'),
  'interval' => envv('BYBIT_KLINE_INTERVAL', '1'),
  'klineLimit' => intval(envv('BYBIT_KLINE_LIMIT', '80')),
  'minRunGapSeconds' => intval(envv('BYBIT_MIN_RUN_GAP_SECONDS', '45')),
  'freshDataSeconds' => intval(envv('BYBIT_FRESH_DATA_SECONDS', '50')),
  'requestGapMs' => intval(envv('BYBIT_REQUEST_GAP_MS', '750')),
  'cooldownSeconds' => intval(envv('BYBIT_COOLDOWN_SECONDS', '90')),
  'timeoutSeconds' => intval(envv('BYBIT_TIMEOUT_SECONDS', '12')),
  'minValidPrice' => floatval(envv('BYBIT_MIN_VALID_PRICE', '1000')),
  'maxValidPrice' => floatval(envv('BYBIT_MAX_VALID_PRICE', '10000')),
  'maxAllowedSpread' => floatval(envv('BYBIT_MAX_ALLOWED_SPREAD', '10')),
];

$nowMs = now_ms();
$token = $_GET['token'] ?? ($_POST['token'] ?? '');

if ($config['cronSecret'] !== '' && !hash_equals($config['cronSecret'], (string) $token)) {
  respond(401, [
    'ok' => false,
    'step' => '10G',
    'error' => 'Unauthorized cron token',
    'updatedAt' => $nowMs,
    'updatedAtText' => gmdate('c'),
  ]);
}

try {
  $basePath = '/bybit_test/xauusdt';
  $oldStatus = firebase_get($config['firebaseDatabaseUrl'], $basePath . '/status');
  $oldLatest = firebase_get($config['firebaseDatabaseUrl'], $basePath . '/latest');

  $lastRunAt = intval($oldStatus['updatedAt'] ?? 0);
  $cooldownUntil = intval($oldStatus['cooldownUntil'] ?? 0);
  $latestUpdatedAt = intval($oldLatest['updatedAt'] ?? 0);
  $latestAgeSec = $latestUpdatedAt > 0 ? floor(($nowMs - $latestUpdatedAt) / 1000) : null;
  $lastRunAgeSec = $lastRunAt > 0 ? floor(($nowMs - $lastRunAt) / 1000) : null;

  if ($cooldownUntil > $nowMs) {
    $payload = make_status($config, [
      'ok' => true,
      'state' => 'cooldown-skip',
      'message' => 'Cron dilewati karena masih cooldown dari rate-limit/error sebelumnya.',
      'lastRunAgeSeconds' => $lastRunAgeSec,
      'latestAgeSeconds' => $latestAgeSec,
      'cooldownUntil' => $cooldownUntil,
      'cooldownLeftSeconds' => max(0, ceil(($cooldownUntil - $nowMs) / 1000)),
      'updatedAt' => $nowMs,
    ]);
    firebase_put($config['firebaseDatabaseUrl'], $basePath . '/status', $payload);
    respond(200, $payload);
  }

  if ($lastRunAt > 0 && ($nowMs - $lastRunAt) < ($config['minRunGapSeconds'] * 1000)) {
    $payload = make_status($config, [
      'ok' => true,
      'state' => 'gap-skip',
      'message' => 'Cron dilewati agar tidak terlalu sering memukul Bybit API.',
      'lastRunAgeSeconds' => $lastRunAgeSec,
      'latestAgeSeconds' => $latestAgeSec,
      'nextAllowedAt' => $lastRunAt + ($config['minRunGapSeconds'] * 1000),
      'updatedAt' => $nowMs,
    ]);
    firebase_put($config['firebaseDatabaseUrl'], $basePath . '/status', $payload);
    respond(200, $payload);
  }

  if ($latestUpdatedAt > 0 && ($nowMs - $latestUpdatedAt) < ($config['freshDataSeconds'] * 1000)) {
    $payload = make_status($config, [
      'ok' => true,
      'state' => 'fresh-skip',
      'message' => 'Data latest masih fresh, request Bybit tidak perlu diulang.',
      'lastRunAgeSeconds' => $lastRunAgeSec,
      'latestAgeSeconds' => $latestAgeSec,
      'updatedAt' => $nowMs,
    ]);
    firebase_put($config['firebaseDatabaseUrl'], $basePath . '/status', $payload);
    respond(200, $payload);
  }

  $tickerUrl = 'https://api.bybit.com/v5/market/tickers?' . http_build_query([
    'category' => $config['category'],
    'symbol' => $config['symbol'],
  ]);
  $ticker = bybit_get_json($tickerUrl, $config['timeoutSeconds']);
  guard_bybit_response($ticker, 'ticker', $config);

  usleep(max(250, $config['requestGapMs']) * 1000);

  $klineUrl = 'https://api.bybit.com/v5/market/kline?' . http_build_query([
    'category' => $config['category'],
    'symbol' => $config['symbol'],
    'interval' => $config['interval'],
    'limit' => clamp_int($config['klineLimit'], 20, 200),
  ]);
  $kline = bybit_get_json($klineUrl, $config['timeoutSeconds']);
  guard_bybit_response($kline, 'kline', $config);

  $tickerRow = $ticker['json']['result']['list'][0] ?? [];
  $klineRows = $kline['json']['result']['list'] ?? [];
  $candles = normalize_klines($klineRows);
  $lastCandle = count($candles) ? $candles[count($candles) - 1] : null;

  $lastPrice = floatval($tickerRow['lastPrice'] ?? ($lastCandle['close'] ?? 0));
  $bid = floatval($tickerRow['bid1Price'] ?? 0);
  $ask = floatval($tickerRow['ask1Price'] ?? 0);
  $spread = ($bid > 0 && $ask > 0) ? abs($ask - $bid) : null;

  $guard = validate_market($lastPrice, $spread, $config);
  if (!$guard['ok']) {
    throw new RuntimeException('Guard failed: ' . $guard['message']);
  }

  $latestPayload = [
    'ok' => true,
    'step' => '10G',
    'source' => 'php-id-cron-safe-rate-limit',
    'market' => 'Bybit USDT Perpetual',
    'symbol' => $config['symbol'],
    'category' => $config['category'],
    'interval' => $config['interval'],
    'lastPrice' => $lastPrice,
    'ticker' => $tickerRow,
    'candles' => $candles,
    'lastCandle' => $lastCandle,
    'guard' => array_merge($guard, [
      'minValidPrice' => $config['minValidPrice'],
      'maxValidPrice' => $config['maxValidPrice'],
      'maxAllowedSpread' => $config['maxAllowedSpread'],
    ]),
    'rateLimit' => [
      'safeMode' => true,
      'requestCount' => 2,
      'requestGapMs' => $config['requestGapMs'],
      'ticker' => extract_rate_headers($ticker['headers']),
      'kline' => extract_rate_headers($kline['headers']),
    ],
    'updatedAt' => $nowMs,
    'updatedAtText' => gmdate('c'),
  ];

  $statusPayload = make_status($config, [
    'ok' => true,
    'state' => 'live',
    'message' => 'Bybit safe cron berhasil update latest.',
    'tickerHttpStatus' => $ticker['status'],
    'klineHttpStatus' => $kline['status'],
    'candleCount' => count($candles),
    'lastPrice' => $lastPrice,
    'spread' => $spread,
    'guard' => 'passed',
    'rateLimit' => $latestPayload['rateLimit'],
    'latestAgeSeconds' => 0,
    'updatedAt' => $nowMs,
  ]);

  firebase_put($config['firebaseDatabaseUrl'], $basePath . '/latest', $latestPayload);
  firebase_put($config['firebaseDatabaseUrl'], $basePath . '/status', $statusPayload);
  firebase_put($config['firebaseDatabaseUrl'], $basePath . '/error', [
    'ok' => true,
    'step' => '10G',
    'message' => 'No active error',
    'updatedAt' => $nowMs,
    'updatedAtText' => gmdate('c'),
  ]);

  respond(200, $statusPayload);
} catch (Throwable $e) {
  $cooldownUntil = now_ms() + ($config['cooldownSeconds'] * 1000);
  $errorPayload = [
    'ok' => false,
    'step' => '10G',
    'source' => 'php-id-cron-safe-rate-limit',
    'message' => $e->getMessage(),
    'cooldownUntil' => $cooldownUntil,
    'cooldownLeftSeconds' => $config['cooldownSeconds'],
    'details' => [
      'type' => get_class($e),
      'symbol' => $config['symbol'],
      'category' => $config['category'],
    ],
    'updatedAt' => now_ms(),
    'updatedAtText' => gmdate('c'),
  ];

  try {
    firebase_put($config['firebaseDatabaseUrl'], '/bybit_test/xauusdt/error', $errorPayload);
    firebase_put($config['firebaseDatabaseUrl'], '/bybit_test/xauusdt/status', make_status($config, [
      'ok' => false,
      'state' => 'error-cooldown',
      'message' => 'Bybit cron error. Latest lama tidak dihapus. Cron masuk cooldown otomatis.',
      'guard' => 'failed',
      'cooldownUntil' => $cooldownUntil,
      'cooldownLeftSeconds' => $config['cooldownSeconds'],
      'updatedAt' => now_ms(),
    ]));
  } catch (Throwable $ignored) {}

  respond(200, $errorPayload);
}

function envv($key, $fallback = '') {
  $value = getenv($key);
  if ($value === false || $value === '') return $fallback;
  return $value;
}

function now_ms() {
  return (int) floor(microtime(true) * 1000);
}

function respond($status, $payload) {
  http_response_code($status);
  echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
  exit;
}

function make_status($config, $extra) {
  $updatedAt = intval($extra['updatedAt'] ?? now_ms());
  return array_merge([
    'ok' => true,
    'step' => '10G',
    'source' => 'php-id-cron-safe-rate-limit',
    'symbol' => $config['symbol'],
    'category' => $config['category'],
    'interval' => $config['interval'],
    'updatedAt' => $updatedAt,
    'updatedAtText' => gmdate('c', (int) floor($updatedAt / 1000)),
    'safeCron' => [
      'enabled' => true,
      'minRunGapSeconds' => $config['minRunGapSeconds'],
      'freshDataSeconds' => $config['freshDataSeconds'],
      'requestGapMs' => $config['requestGapMs'],
      'cooldownSeconds' => $config['cooldownSeconds'],
    ],
  ], $extra);
}

function bybit_get_json($url, $timeoutSeconds) {
  $headers = [];
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => min(8, max(3, $timeoutSeconds)),
    CURLOPT_TIMEOUT => max(6, $timeoutSeconds),
    CURLOPT_HTTPHEADER => [
      'Accept: application/json',
      'User-Agent: XAU-AI-Signal-Step10G-SafeCron/1.0',
    ],
    CURLOPT_HEADERFUNCTION => function($curl, $header) use (&$headers) {
      $len = strlen($header);
      $parts = explode(':', $header, 2);
      if (count($parts) === 2) {
        $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
      }
      return $len;
    },
  ]);

  $body = curl_exec($ch);
  $errno = curl_errno($ch);
  $error = curl_error($ch);
  $status = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
  curl_close($ch);

  if ($errno) {
    throw new RuntimeException('cURL error: ' . $error);
  }

  $json = json_decode((string) $body, true);
  if (!is_array($json)) {
    throw new RuntimeException('Bybit response bukan JSON valid. HTTP ' . $status);
  }

  return [
    'status' => $status,
    'json' => $json,
    'headers' => $headers,
  ];
}

function guard_bybit_response($response, $name, $config) {
  $status = intval($response['status'] ?? 0);
  $json = $response['json'] ?? [];
  $retCode = intval($json['retCode'] ?? -1);
  $retMsg = (string) ($json['retMsg'] ?? 'Unknown');

  if ($status === 429 || $retCode === 10006) {
    throw new RuntimeException('Bybit rate limit pada ' . $name . ': HTTP ' . $status . ' / retCode ' . $retCode . ' / ' . $retMsg);
  }

  if ($status < 200 || $status >= 300) {
    throw new RuntimeException('Bybit HTTP error pada ' . $name . ': HTTP ' . $status . ' / ' . $retMsg);
  }

  if ($retCode !== 0) {
    throw new RuntimeException('Bybit API error pada ' . $name . ': retCode ' . $retCode . ' / ' . $retMsg);
  }
}

function normalize_klines($rows) {
  $candles = [];
  foreach ($rows as $row) {
    if (!is_array($row) || count($row) < 5) continue;
    $start = intval($row[0]);
    $candles[] = [
      'time' => gmdate('Y-m-d H:i:s', (int) floor($start / 1000)),
      'timestamp' => $start,
      'open' => floatval($row[1]),
      'high' => floatval($row[2]),
      'low' => floatval($row[3]),
      'close' => floatval($row[4]),
      'volume' => floatval($row[5] ?? 0),
      'turnover' => floatval($row[6] ?? 0),
    ];
  }

  usort($candles, fn($a, $b) => ($a['timestamp'] <=> $b['timestamp']));
  return $candles;
}

function validate_market($lastPrice, $spread, $config) {
  if ($lastPrice < $config['minValidPrice'] || $lastPrice > $config['maxValidPrice']) {
    return [
      'ok' => false,
      'state' => 'failed',
      'message' => 'Harga di luar range guard.',
    ];
  }

  if ($spread !== null && $spread > $config['maxAllowedSpread']) {
    return [
      'ok' => false,
      'state' => 'failed',
      'message' => 'Spread terlalu lebar.',
    ];
  }

  return [
    'ok' => true,
    'state' => 'passed',
    'message' => 'Data lolos guard.',
  ];
}

function extract_rate_headers($headers) {
  return [
    'limit' => $headers['x-bapi-limit'] ?? null,
    'status' => $headers['x-bapi-limit-status'] ?? null,
    'resetTimestamp' => $headers['x-bapi-limit-reset-timestamp'] ?? null,
  ];
}

function firebase_get($dbUrl, $path) {
  $url = $dbUrl . $path . '.json?ts=' . now_ms();
  $json = http_json($url, 'GET');
  return is_array($json) ? $json : null;
}

function firebase_put($dbUrl, $path, $data) {
  return http_json($dbUrl . $path . '.json', 'PUT', $data);
}

function http_json($url, $method = 'GET', $data = null) {
  $ch = curl_init($url);
  $options = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  ];
  if ($data !== null) {
    $options[CURLOPT_POSTFIELDS] = json_encode($data, JSON_UNESCAPED_SLASHES);
  }
  curl_setopt_array($ch, $options);
  $body = curl_exec($ch);
  $errno = curl_errno($ch);
  $error = curl_error($ch);
  $status = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
  curl_close($ch);

  if ($errno) throw new RuntimeException('Firebase cURL error: ' . $error);
  if ($status < 200 || $status >= 300) throw new RuntimeException('Firebase HTTP error ' . $status . ': ' . $body);

  $decoded = json_decode((string) $body, true);
  return $decoded;
}

function clamp_int($value, $min, $max) {
  return max($min, min($max, intval($value)));
}
