# XAU Firebase Bandwidth Saver Full Fix

Masalah:
- Firebase RTDB downloads cepat naik karena web sering mengambil JSON candle besar.
- Auto refresh sebelumnya mengambil /api/market full chart terlalu sering.

Fix hemat bandwidth:
1. Endpoint /api/market sekarang punya mode:
   - /api/market?mode=lite
     Data kecil saja: symbol, bid, ask, time, candle count.
   - /api/market?mode=chart&m1=90&m15=60
     Data chart, tapi candle dibatasi.

2. Web refresh dipisah:
   - Lite/price/signal refresh: 12 detik
   - Chart candle refresh: 45 detik
   - History refresh: 60 detik

3. Candle yang dikirim ke chart diperkecil:
   - M1: 90 candle
   - M15: 60 candle

4. Cache header ditambahkan:
   - lite cache sekitar 6 detik
   - chart cache sekitar 20 detik
   - history cache sekitar 30 detik

5. Semua strategi tetap:
   - Main CALL
   - Fresh OB M15
   - M1 last swing structure scalping
   - Telegram command
   - CALL history

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/market.js
- functions/api/call-history.js
- src/App.jsx
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Refresh web.
5. Cek:
   /api/market?mode=lite
   /api/market?mode=chart&m1=90&m15=60