# XAU Telegram Webhook Commands Full Fix

Fitur baru:
- /start aktif
- /status aktif
- /signal aktif
- /help aktif
- Endpoint setup webhook:
  /api/telegram-set-webhook?secret=ISI_SECRET_KAMU
- Endpoint webhook:
  /api/telegram-webhook
- Endpoint test:
  /api/telegram-test

ENV Cloudflare:
- FIREBASE_DATABASE_URL
- MT5_INGEST_TOKEN
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- TELEGRAM_ALERT_ENABLED=true
- TELEGRAM_READY_ALERT_ENABLED=false
- TELEGRAM_WEBHOOK_SECRET=buat_secret_bebas

Cara pasang:
1. Upload replace semua ke GitHub.
2. Deploy Cloudflare.
3. Tambahkan ENV TELEGRAM_WEBHOOK_SECRET.
4. Buka:
   https://xau-ai-signal.pages.dev/api/telegram-set-webhook?secret=ISI_SECRET_KAMU
5. Kalau JSON ok true, buka Telegram dan coba:
   /start
   /status
   /signal
   /help
