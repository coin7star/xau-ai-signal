# Step 10AQ5 - Partial TP + EMA Touch Candle SL

Perubahan strategi utama M5:

- Entry tetap di EMA 9 M5 saat struktur M5 valid dan candle menyentuh area EMA 9/20.
- SL tidak lagi dihitung RR 1:1 dari TP.
- BUY SL memakai low candle M5 yang menyentuh area EMA dikurangi 0.5 ATR.
- SELL SL memakai high candle M5 yang menyentuh area EMA ditambah 0.5 ATR.
- TP dibuat parsial:
  - TP1 = 50% jarak dari entry ke TP2.
  - TP2 = target utama di body swing.
- Chart menampilkan garis Entry, SL, TP1, dan TP2.
- Legacy field `tp` tetap memakai TP2 agar auto result lama tetap membaca target utama.

Catatan:
- TP1 adalah target parsial/ambil sebagian.
- Auto result utama tetap menutup WIN pada TP2 untuk menjaga statistik bersih.
