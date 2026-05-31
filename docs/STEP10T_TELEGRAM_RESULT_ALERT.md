# Step 10T — Telegram Result Alert

Auto Result Engine sekarang mengirim notifikasi Telegram saat signal RUNNING berubah menjadi WIN, LOSS, atau EXPIRED.

## Perubahan
- Endpoint `/api/result-tracker` tetap dipakai untuk menjalankan auto result.
- Saat signal ditutup otomatis, sistem mengirim result alert premium ke Telegram.
- Anti duplicate memakai field `resultAlertSent`.
- Jika Telegram ENV belum siap, result tetap tersimpan dan field `resultAlertSkippedReason` dicatat.

## ENV
Minimal:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PUBLIC_DASHBOARD_URL` opsional

Opsional:
- `RESULT_ALERT_ENABLED=false` untuk mematikan result alert sementara.
