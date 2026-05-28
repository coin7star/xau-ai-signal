# XAU OB Impulse Breakout Full Fix

Penjelasan penting:
- MQ5 / MetaEditor TIDAK menghitung OB.
- MQ5 cuma kirim candle M1 dan M15.
- OB dihitung di Cloudflare Functions:
  - functions/api/signal.js
  - functions/api/telegram-webhook.js

Update OB v3:
- Tetap pakai SMC BOS klasik.
- Ditambah detection visual: IMPULSE_BREAKOUT.
- Bullish OB:
  - candle bearish/base terakhir sebelum impulse bullish
  - impulse bullish harus break recent resistance/high 20 candle terakhir
- Bearish OB:
  - candle bullish/base terakhir sebelum impulse bearish
  - impulse bearish harus break recent support/low 20 candle terakhir

Mitigation:
- OB tidak hilang hanya karena wick sentuh tipis.
- OB baru mitigated kalau retrace minimal 50% zona OB setelah breakout/BOS.
- OB invalid kalau close tembus sisi lawan OB.

Chart:
- Garis OB M15 tetap tampil di chart M1 dan M15 selama OB masih active/fresh.
- EMA 9 dan EMA 20 tetap tampil.

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
5. Cek /api/signal, lihat strategy.smc.version harus:
   SMC_OB_V3_IMPULSE_BREAKOUT
