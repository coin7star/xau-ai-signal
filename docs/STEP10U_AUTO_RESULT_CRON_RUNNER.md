# Step 10U — Auto Result Cron Runner

Step ini membuat result tracker berjalan otomatis lewat cron, tanpa klik manual.

## Sumber harga

Auto result hanya membaca live feed utama dari MT5/VPS di path Firebase:

```txt
/xauusd/latest
```

Bybit test feed tidak dipakai untuk menentukan WIN/LOSS/EXPIRED. Path Bybit tetap hanya untuk backup market test/read only.

## Endpoint baru

```txt
GET /api/result-tracker-cron?token=RESULT_TRACKER_CRON_SECRET
POST /api/result-tracker-cron
```

Endpoint ini:
- wajib memakai `RESULT_TRACKER_CRON_SECRET`
- punya cooldown anti-spam
- membaca harga dari MT5/VPS live feed
- memanggil Auto Result Engine
- mengirim Telegram result alert jika ada signal yang berubah ke WIN/LOSS/EXPIRED
- tetap memakai anti-duplicate `resultAlertSent`

## File PHP Cron

File baru:

```txt
cron/result-tracker-cron-runner.php
```

Upload file ini ke PHP.ID / hosting PHP, lalu set ENV:

```env
RESULT_TRACKER_CRON_URL=https://www.xauaisignal.online/api/result-tracker-cron
RESULT_TRACKER_CRON_SECRET=secret_yang_sama_dengan_cloudflare
```

Jalankan cron tiap 1 menit atau 2 menit.

## ENV Cloudflare

Wajib:

```env
RESULT_TRACKER_CRON_SECRET=buat_secret_sendiri
```

Opsional:

```env
RESULT_TRACKER_CRON_COOLDOWN_SEC=60
RESULT_TRACKER_REQUIRE_FRESH_MT5=true
RESULT_TRACKER_MT5_MAX_AGE_SEC=1800
RESULT_TRACKER_MAIN_EXPIRE_HOURS=24
RESULT_TRACKER_SCALP_EXPIRE_HOURS=4
```

## Catatan

Jika market weekend dan MT5/VPS tidak mengirim data fresh, cron akan skip supaya tidak menutup signal berdasarkan harga lama.
