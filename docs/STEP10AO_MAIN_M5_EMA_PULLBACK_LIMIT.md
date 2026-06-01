# Step 10AO — Main Signal M5 EMA Pullback Limit

Patch ini mengganti Strategy A / Sinyal Utama menjadi strategi M5 berbasis EMA 9/20 pullback limit.

## Rule BUY
- EMA 9 M5 break ke atas EMA 20.
- Tunggu harga koreksi ke area EMA 9.
- Saat koreksi valid, sistem membuat BUY LIMIT di EMA 9.
- TP di atas swing high koreksi.
- SL memakai jarak 1:1 dari entry ke TP.

## Rule SELL
- EMA 9 M5 break ke bawah EMA 20.
- Tunggu harga koreksi ke area EMA 9.
- Saat koreksi valid, sistem membuat SELL LIMIT di EMA 9.
- TP di bawah swing low koreksi.
- SL memakai jarak 1:1 dari entry ke TP.

## Data M5
- Jika MT5/VPS sudah menyediakan `candlesM5`, sistem memakai M5 native.
- Jika belum tersedia, sistem fallback membuat M5 dari candle M1.

## Catatan
- Strategy B / SMC AI tidak diubah.
- M5 Scalp tetap terpisah.
- Bybit tidak dipakai untuk hitung signal.
