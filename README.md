# XAU Telegram Disable Old Commands Hardfix

Masalah:
- /signal masih membalas data panjang walaupun sudah deploy command clean.
- Penyebab: routing webhook lama masih kepakai.

Hardfix:
- onRequest telegram-webhook.js diganti total.
- Command aktif:
  /start
  /status
  /help

Command lama:
  /signal
  /history
  /scalp_history
  /scalphistory

Sekarang command lama TIDAK membaca Firebase / RTDB lagi.
Command lama cuma redirect ke tombol Mini App:
🚀 Open XAU AI Dashboard

Auto alert:
- MAIN CALL alert tetap jalan.
- Update ini hanya mengubah balasan command manual.

ENV opsional:
DASHBOARD_URL=https://xau-ai-signal.pages.dev

BotFather Edit Commands:
start - Buka dashboard XAU AI
status - Cek status bot
help - Panduan penggunaan

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/telegram-webhook.js
- package.json

Cara pakai:
1. Upload replace semua file ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy sukses.
4. Test:
   /signal
   /history
   /scalp_history

Harusnya tidak muncul Signal Radar panjang lagi.