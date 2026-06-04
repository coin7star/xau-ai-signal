# Step 10BU — Pullback Limit Touch Buffer Fix

Update ini merapikan area limit pullback EMA agar tidak terlalu jauh dari area yang kemungkinan tersentuh.

## Perubahan utama

- Strategi utama tetap M1 EMA Cross Direct Entry.
- Entry agresif tetap mengikuti candle M1 close setelah EMA cross valid.
- Opsi limit pullback tetap aktif untuk user yang telat entry agresif.
- BUY limit diarahkan ke area EMA bawah dengan touch buffer kecil.
- SELL limit diarahkan ke area EMA atas dengan touch buffer kecil agar tidak terlalu bawah.
- SL tetap smart swing anchor ± 0.2 ATR.
- TP Max tetap RR 1:1.25.
- TP1 tetap 50% menuju TP Max lalu BE aktif.

## Catatan

Fix ini hanya mengubah posisi rencana limit pullback agar lebih enak untuk entry manual. Logic result tracker, cron TP/SL/BE, Telegram result, dan RTDB Lite tidak diubah.
