# XAU Fresh OB Lines Only Full Fix

Update:
- Garis OB M15 tetap digambar di chart M1 dan chart M15.
- Yang digambar hanya OB M15 fresh / active.
- Kalau OB status mitigated atau invalid, garis OB otomatis tidak tampil.
- Label garis OB sekarang lebih jelas:
  - M15 Fresh Bull OB Low
  - M15 Fresh Bull OB High
  - M15 Fresh Bear OB Low
  - M15 Fresh Bear OB High
- Logika status OB dirapikan:
  - mitigated/invalid baru dicek setelah BOS
  - candle origin/displacement tidak langsung bikin OB dianggap mitigated
- MQ5 tidak perlu update.

File yang berubah:
- src/App.jsx
- functions/api/signal.js
- functions/api/telegram-webhook.js
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy sukses.
4. Refresh web.
