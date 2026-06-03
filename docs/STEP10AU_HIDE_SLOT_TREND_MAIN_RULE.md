# STEP10AU - Hide Slot Trend Panel

Update UI kecil setelah strategi utama diganti ke M1 EMA Cross Direct Entry.

## Perubahan
- Panel `Slot Trend` lama disembunyikan/diganti agar tidak membingungkan.
- UI sekarang menampilkan `Main Rule` yang sesuai strategi aktif.
- Strategi utama tetap hanya `M1 EMA Cross Direct Entry`.
- SMC AI, Scalp, M5, OB/MFI/RSI filter lama tetap tidak dipakai untuk main signal.

## Rule aktif
BUY:
- EMA9 cross ke atas EMA20 di M1.
- Candle close di atas EMA9 dan EMA20.
- Entry BUY langsung setelah candle close.
- SL swing low terdekat - 0.1 ATR.
- TP Max RR 1:1, TP1 setengah jarak, TP1 kena -> SL ke BE.

SELL:
- EMA9 cross ke bawah EMA20 di M1.
- Candle close di bawah EMA9 dan EMA20.
- Entry SELL langsung setelah candle close.
- SL swing high terdekat + 0.1 ATR.
- TP Max RR 1:1, TP1 setengah jarak, TP1 kena -> SL ke BE.
