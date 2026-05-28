# XAU MT5 Stale Auto Pause Refresh Fix

Update:
- Web otomatis mendeteksi MT5/VPS offline atau data stale.
- Kalau receivedAt market lebih dari 3 menit:
  - chart refresh dipause
  - history refresh dipause
  - scalp history refresh dipause
  - lite check diperlambat dari 12 detik ke 60 detik
- Tujuan: hemat Firebase RTDB Downloads saat MT5/VPS mati.
- Jika MT5 hidup lagi, lite check akan mendeteksi update dan auto refresh normal kembali.
- Ada banner:
  MT5 / VPS OFFLINE MODE
- Ada tombol Manual Refresh.

Mode refresh:
- MT5 live:
  lite 12s, chart 45s, history 60s, scalp 90s
- MT5 stale/offline:
  lite 60s only, heavy refresh paused

File berubah:
- src/App.jsx
- src/style.css
- package.json

MQ5:
- Tidak perlu update.

Catatan:
- Threshold stale: 3 menit.
- Data lama tetap tampil, tapi refresh berat dipause.