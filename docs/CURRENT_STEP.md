# Step 10BQ — Smart Swing Anchor SL Fix

## Tujuan
Merapikan posisi SL untuk strategi utama **M1 EMA Cross Direct Entry** agar SELL lebih sering memakai swing high pullback terakhir sebelum breakdown/cross, dan BUY memakai swing low pullback terakhir sebelum breakout/cross.

## Perubahan
- Logic SL tidak hanya memilih swing terdekat yang sangat kecil.
- Lookback anchor diperluas ke ±15 candle M1 sebelum candle entry.
- Batas 2.5 ATR tetap menjadi soft limit.
- Swing visual yang valid masih bisa dipakai sampai hard limit ±4 ATR agar swing utama tidak langsung diskip.
- Fallback tetap memakai high/low terbaru kalau swing confirmed belum ada.
- Debug structure menampilkan sumber swing, waktu swing, index, soft max distance, dan hard max distance.

## Rule aktif tetap sama
- BUY: EMA9 cross up EMA20, candle M1 close di atas EMA9/EMA20.
- SELL: EMA9 cross down EMA20, candle M1 close di bawah EMA9/EMA20.
- SL: Smart swing anchor ± 0.2 ATR.
- TP Max: RR 1:1.25.
- TP1: 50% jarak menuju TP Max, lalu SL pindah ke BE.

## Catatan
Strategi, Telegram, auto result, TP1/BE, RTDB Lite, dan candle close sync tidak diubah. Step ini hanya memperbaiki pemilihan anchor SL.
