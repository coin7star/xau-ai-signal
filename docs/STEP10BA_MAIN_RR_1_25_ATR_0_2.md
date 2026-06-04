# Step 10BA — Main RR 1:1.25 + ATR 0.2 Buffer

Update rule strategi utama M1 EMA Cross Direct Entry.

## Perubahan

- Strategi utama tetap hanya `M1 EMA Cross Direct Entry`.
- Entry tetap direct setelah candle M1 close valid.
- SL buffer diubah:
  - BUY: swing low terdekat - `0.2 ATR`
  - SELL: swing high terdekat + `0.2 ATR`
- TP Max diubah dari RR `1:1` menjadi RR `1:1.25`.
- TP1 tetap di tengah jarak menuju TP Max.
- Setelah TP1 kena, SL tetap pindah ke BE.

## BUY

1. EMA9 cross ke atas EMA20.
2. Candle M1 close di atas EMA9 dan EMA20.
3. Entry BUY langsung setelah candle close.
4. SL di bawah swing low terdekat - 0.2 ATR.
5. TP Max RR 1:1.25.
6. TP1 = setengah jarak menuju TP Max.
7. Saat TP1 kena, SL pindah ke BE.

## SELL

1. EMA9 cross ke bawah EMA20.
2. Candle M1 close di bawah EMA9 dan EMA20.
3. Entry SELL langsung setelah candle close.
4. SL di atas swing high terdekat + 0.2 ATR.
5. TP Max RR 1:1.25.
6. TP1 = setengah jarak menuju TP Max.
7. Saat TP1 kena, SL pindah ke BE.

## Catatan

- SMC AI dan Scalp tetap tidak dipakai untuk sinyal utama.
- Telegram alert, history, dan auto result tetap mengikuti sinyal utama.
- Perubahan ini membuat target lebih jauh dan SL sedikit lebih longgar dibanding Step 10AZ.
