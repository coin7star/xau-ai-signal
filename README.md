# XAU Telegram Mini App Command Clean Full Fix

Update:
- Bot command dibuat Mini App First.
- Command aktif:
  /start
  /status
  /help

Command lama:
- /signal
- /history
- /scalp_history

Sekarang command lama tidak menampilkan data panjang lagi.
Command lama akan diarahkan ke tombol Open Dashboard.

Auto alert:
- MAIN CALL alert tetap otomatis masuk Telegram.
- Tidak dimatikan.

Tombol Mini App:
- /start menampilkan tombol:
  🚀 Open XAU AI Dashboard

ENV opsional:
- DASHBOARD_URL=https://xau-ai-signal.pages.dev

Kalau ENV DASHBOARD_URL tidak diisi, default tetap:
https://xau-ai-signal.pages.dev

BotFather command list yang disarankan:
start - Buka dashboard XAU AI
status - Cek status bot
help - Panduan penggunaan

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/telegram-webhook.js
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Di BotFather, Edit Commands:
   start - Buka dashboard XAU AI
   status - Cek status bot
   help - Panduan penggunaan
5. Test Telegram:
   /start
   /signal