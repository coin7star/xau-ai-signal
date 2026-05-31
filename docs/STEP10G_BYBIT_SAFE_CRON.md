# Step 10G — Bybit Rate Limit Safe Cron

Step ini menambahkan cron PHP yang lebih aman untuk membaca Bybit XAUUSDT Perpetual tanpa terlalu sering memukul API.

## File baru

- `cron/bybit-xauusdt-safe-cron.php`

## Path Firebase yang dipakai

Tetap path test, jadi tidak mengganggu MT5 utama:

- `/bybit_test/xauusdt/latest`
- `/bybit_test/xauusdt/status`
- `/bybit_test/xauusdt/error`

## ENV / setting di hosting PHP.ID

Wajib / disarankan:

```env
FIREBASE_DATABASE_URL=https://xauusd-signal-web-default-rtdb.firebaseio.com
BYBIT_CRON_SECRET=buat_secret_sendiri
```

Opsional:

```env
BYBIT_SYMBOL=XAUUSDT
BYBIT_CATEGORY=linear
BYBIT_KLINE_INTERVAL=1
BYBIT_KLINE_LIMIT=80
BYBIT_MIN_RUN_GAP_SECONDS=45
BYBIT_FRESH_DATA_SECONDS=50
BYBIT_REQUEST_GAP_MS=750
BYBIT_COOLDOWN_SECONDS=90
BYBIT_TIMEOUT_SECONDS=12
BYBIT_MIN_VALID_PRICE=1000
BYBIT_MAX_VALID_PRICE=10000
BYBIT_MAX_ALLOWED_SPREAD=10
```

## Cara pasang di PHP.ID

1. Upload `cron/bybit-xauusdt-safe-cron.php` ke hosting PHP.ID.
2. Set ENV di hosting kalau tersedia. Kalau hosting tidak support ENV, isi manual bagian `$config` di file PHP.
3. Buat cron job setiap 1 menit ke URL:

```txt
https://domain-cron-kamu.com/bybit-xauusdt-safe-cron.php?token=ISI_BYBIT_CRON_SECRET
```

4. Buka dashboard sebagai admin.
5. Cek panel `BYBIT TEST FEED · READ ONLY`.
6. Pastikan Step berubah ke `10G` dan status `LIVE` / `fresh-skip` / `gap-skip` muncul normal.

## Cara kerja aman untuk pemula

- Cron tidak langsung request Bybit kalau data masih fresh.
- Cron tidak request ulang kalau jarak dari run sebelumnya masih terlalu dekat.
- Kalau Bybit membalas rate limit, cron membuat cooldown otomatis.
- Kalau error, data latest lama tidak dihapus, jadi panel tidak blank.
- Semua masih read-only untuk project utama; signal MT5, chart utama, Telegram utama belum diganti ke Bybit.

## Sumber endpoint Bybit

Step ini memakai endpoint resmi Bybit V5:

- `GET /v5/market/tickers`
- `GET /v5/market/kline`

Bybit menjelaskan rate limit berbasis rolling time window per detik, dan error `retCode: 10006` berarti terlalu banyak request.
