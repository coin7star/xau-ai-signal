# Step 10BK — Nearest Swing SL Fix

Update strategi utama M1 EMA Cross Direct Entry agar SL tidak lagi mengambil swing high/low yang terlalu jauh.

## Perubahan

- BUY memakai swing low terdekat dari sekitar 10 candle M1 sebelum entry.
- SELL memakai swing high terdekat dari sekitar 10 candle M1 sebelum entry.
- Jika swing confirmed belum ada, sistem memakai fallback high/low terdekat dari 8 candle terakhir.
- Swing yang terlalu jauh diprioritaskan untuk dilewati dengan batas referensi sekitar 2.5 ATR.
- Buffer SL tetap 0.2 ATR.
- TP Max tetap RR 1:1.25.
- TP1 tetap 50% menuju TP Max lalu BE aktif.

## Tujuan

Mengurangi kasus SL mengambil swing jauh padahal di dekat candle entry sudah ada high/low yang lebih relevan untuk setup M1.
