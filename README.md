# XAU Rollback After Source Label Object Fix

Recovery:
- Rollback dari source label patch yang bikin [object Object].
- Balik ke versi aman sebelumnya:
  - web tidak blank
  - chart/candle normal
  - admin panel normal
  - copywriting offline tetap profesional

Yang sementara dibiarkan:
- Source: Firebase RTDB
- Badge not-call-signal

Alasan:
- Dua label ini datang dari render/variable sensitif.
- Patch otomatis ke status/source beberapa kali memicu [object Object] atau blank.
- Lebih aman biarkan dulu sampai App.jsx dibedah manual.

Tidak disentuh:
- Admin Panel
- Chart/candle
- MQ5
- Telegram logic
- Firebase logic

Deploy:
1. Upload ZIP ini.
2. Deploy Cloudflare.
3. Tekan Ctrl + Shift + R.

MQ5:
- Tidak perlu update.