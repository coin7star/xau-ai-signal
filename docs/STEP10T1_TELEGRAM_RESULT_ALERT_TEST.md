# Step 10T1 — Telegram Result Alert Test

Patch ini menambahkan tombol test result alert Telegram untuk WIN, LOSS, dan EXPIRED.

## Tujuan
- Admin bisa mengecek format result alert ke Telegram tanpa menunggu trade asli.
- History asli tidak berubah.
- Endpoint tidak bisa dipanggil bebas dari browser karena hanya menerima POST + kode admin/secret.

## Endpoint baru

```txt
POST /api/result-alert-test
```

## Body

```json
{ "result": "WIN" }
```

Result yang didukung:
- WIN
- LOSS
- EXPIRED

## ENV

Wajib:

```env
ADMIN_ACTION_TOKEN=kode_admin
TELEGRAM_BOT_TOKEN=token_bot
TELEGRAM_CHAT_ID=chat_id_admin
```

Opsional:

```env
TELEGRAM_TEST_SECRET=secret_khusus_test
RESULT_ALERT_TEST_COOLDOWN_SEC=20
PUBLIC_DASHBOARD_URL=https://www.xauaisignal.online
```

## Cara test

Dashboard → Admin → Result Alert Test → pilih Test WIN / Test LOSS / Test EXPIRED.
