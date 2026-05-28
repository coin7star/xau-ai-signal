# XAU Scalp Valid History Full Fix

Update:
- Menambahkan SCALP M1 Valid History.
- Yang disimpan hanya:
  - SCALP BUY valid
  - SCALP SELL valid
- Yang tidak disimpan:
  - SCALP WAIT
  - bias belum matang
  - candle biasa
  - full candle chart

Tujuan:
- History scalp tetap ada untuk tracking.
- Firebase RTDB tetap hemat.
- Data dibatasi 50 scalp valid terakhir.

Endpoint baru:
- GET /api/scalp-history
- POST /api/scalp-history

Telegram:
- Command baru:
  /scalp_history
- Menampilkan 5 scalp valid terakhir.

Web:
- Section baru:
  SCALP M1 Valid History
- Bisa manual result:
  WIN / LOSS / BE / OPEN

Admin token:
- Tetap pakai ENV:
  ADMIN_ACTION_TOKEN

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/signal.js
- functions/api/scalp-history.js
- functions/api/telegram-webhook.js
- src/App.jsx
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Refresh web.
5. Test:
   /api/scalp-history
   Telegram: /scalp_history