# Step 10BV — Pullback Limit More Touchable

Update ini menaikkan/merapikan area **Limit Pullback EMA** supaya order limit tidak mudah miss tipis.

## Perubahan utama

- Strategi utama tetap **M1 EMA Cross Direct Entry**.
- Entry agresif tetap mengikuti candle M1 close setelah EMA9/EMA20 cross valid.
- Opsi kedua tetap **Limit Pullback EMA**.
- BUY limit dinaikkan sedikit dari area EMA bawah agar pullback tipis lebih mudah menyentuh limit.
- SELL limit tetap diarahkan ke area pullback EMA atas dengan touch buffer lebih realistis.
- SL tetap memakai **Smart Swing Anchor ± 0.2 ATR**.
- TP Max tetap **RR 1:1.25**.
- TP1 tetap 50% menuju TP Max lalu SL pindah ke BE.

## Catatan

Limit dibuat lebih mudah tersentuh, tapi tetap tidak boleh mengejar harga terlalu dekat dengan entry agresif. Jika harga sudah jauh dari entry ideal, tunggu setup berikutnya.
