# XAU Scalping Wording User Friendly Full Fix

Masalah:
- Teks sebelumnya: "BUY 32 vs SELL 14" bisa bikin user bingung.
- User bisa salah paham itu jumlah order, padahal itu score internal.

Fix:
- Teks scalping sekarang user-friendly:
  - Scalp Bias: BUY mulai terbentuk / SELL mulai terbentuk / belum jelas
  - BUY Strength xx/100
  - SELL Strength xx/100
  - Trigger minimal 58/100 untuk SCALP BUY/SELL
  - Konfirmasi yang sedang aktif
- Panel web ditambah:
  - Scalp Strength xx/100
- Telegram /signal ikut pakai wording baru.

MQ5 tidak perlu update.

File yang berubah:
- functions/api/signal.js
- functions/api/telegram-webhook.js
- src/App.jsx
- src/style.css
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy sukses.
4. Refresh web.
5. Test Telegram /signal.
