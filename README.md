# XAU Telegram CALL Alert Full Fix

Fitur:
- Kirim Telegram otomatis saat CALL BUY / CALL SELL valid.
- Anti-spam: menyimpan last alert key di Firebase.
- Endpoint test Telegram: /api/telegram-test
- READY alert default mati. Bisa aktif dengan TELEGRAM_READY_ALERT_ENABLED=true.

ENV Cloudflare:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- TELEGRAM_ALERT_ENABLED=true
- TELEGRAM_READY_ALERT_ENABLED=false

Cara BotFather:
1. Telegram buka @BotFather
2. /newbot
3. Buat nama bot
4. Simpan token dari BotFather
5. Chat bot kamu dulu dengan pesan bebas: /start
6. Ambil chat_id pakai:
   https://api.telegram.org/botTOKEN_KAMU/getUpdates
7. Masukkan chat_id ke ENV Cloudflare.
8. Buka /api/telegram-test untuk test.
