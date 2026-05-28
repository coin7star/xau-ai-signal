# XAU OB Mitigation 50% Full Fix

Masalah yang diperbaiki:
- OB fresh kadang hilang terlalu cepat karena wick/sentuhan kecil langsung dianggap mitigated.
- Sekarang OB baru dianggap mitigated jika harga retrace minimal sampai 50% area OB setelah BOS.
- Kalau OB masih active/fresh, garis OB tetap muncul di chart M1 dan chart M15.
- Kalau OB invalid atau sudah retrace 50% zona, garis disembunyikan.

Rule baru:
- Bullish OB mitigated jika candle setelah BOS punya low <= midpoint zona OB.
- Bearish OB mitigated jika candle setelah BOS punya high >= midpoint zona OB.
- Invalid tetap:
  - Bullish OB invalid jika close tembus bawah low OB.
  - Bearish OB invalid jika close tembus atas high OB.

MQ5 tidak perlu update.

File yang berubah:
- functions/api/signal.js
- functions/api/telegram-webhook.js
- src/App.jsx
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy sukses.
4. Refresh web.
