# Step 10BT — Result Tracker Range After Entry Fix

Fix false LOSS/WIN pada auto result saat tracker membaca high/low candle pembentuk sinyal.

## Perubahan

- Result tracker tetap bisa membaca range candle M1 untuk TP1 / TP Max / SL / BE.
- Candle pembentuk sinyal tidak ikut dihitung sebagai range result.
- Range candle dimulai setelah entry aktif / setelah candle sinyal selesai.
- Field `latestHigh` dan `latestLow` global tidak lagi dipakai untuk menutup result karena bisa berasal dari candle sebelum entry.
- Signal history baru menyimpan `entryCandleTime` dan `resultTrackingStartAt`.

## Tujuan

Mencegah kasus posisi SELL/BUY tiba-tiba menjadi Kalah padahal setelah sinyal muncul harga belum pernah menyentuh SL.

## Strategi tetap

- M1 EMA Cross Direct Entry.
- Entry agresif + opsi limit pullback EMA.
- Smart swing SL + 0.2 ATR.
- TP Max RR 1:1.25.
- TP1 mengaktifkan BE.
