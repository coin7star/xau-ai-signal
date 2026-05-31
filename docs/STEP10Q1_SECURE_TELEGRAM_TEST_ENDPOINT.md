# Step 10Q1 — Secure Telegram Test Endpoint

Patch ini mengamankan endpoint `/api/telegram-test`.

## Perubahan
- Endpoint hanya menerima `POST`.
- Request harus membawa `Authorization: Bearer ADMIN_ACTION_TOKEN` atau header `x-admin-test-token: TELEGRAM_TEST_SECRET`.
- Endpoint GET dari browser langsung akan ditolak.
- Ada cooldown anti-spam. Default 30 detik.
- Tombol test alert ditambahkan ke tab Admin.

## ENV
Minimal gunakan ENV yang sudah ada:

```env
ADMIN_ACTION_TOKEN=kode_admin_kamu
TELEGRAM_BOT_TOKEN=token_bot
TELEGRAM_CHAT_ID=chat_id_admin
```

Opsional:

```env
TELEGRAM_TEST_SECRET=secret_khusus_test
TELEGRAM_TEST_COOLDOWN_SEC=30
PUBLIC_DASHBOARD_URL=https://www.xauaisignal.online
```

## Cara test
Masuk dashboard sebagai admin, buka tab Admin, buka jendela Telegram Alert Test, lalu klik Kirim Test Alert.
