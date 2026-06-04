# STEP10BJ - Telegram Call Format TP/SL/BE

## Tujuan
Merampikan format notifikasi Telegram untuk sinyal utama agar TP, SL, TP1, BE, dan TP Max lebih jelas dibaca user premium.

## Perubahan
- Format notifikasi CALL BUY/SELL dibuat lebih terstruktur.
- Bagian `Trade Plan` diganti menjadi `Rencana Entry`.
- Ditambahkan field jelas:
  - Entry
  - SL Awal
  - TP1
  - TP Max
  - BE
  - RR
- Ditambahkan penjelasan alur result otomatis:
  - TP1 tersentuh -> SL pindah ke BE
  - TP Max -> Menang
  - Balik ke entry setelah TP1 -> BE
  - SL sebelum TP1 -> Kalah
- Bagian konfirmasi setup dibuat lebih pendek dan tidak terlalu internal.

## File berubah
- `functions/api/signal.js`
- `package.json`
- `docs/STEP10BJ_TELEGRAM_CALL_FORMAT_TP_SL_BE.md`

## Catatan
Logic strategi, result tracker, cron, dashboard, dan Telegram anti-duplikat tidak diubah. Update ini hanya merapikan format pesan Telegram sinyal baru.
