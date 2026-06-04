# Step 10BY — Limit Analytics Isolation Fix

## Tujuan
Memisahkan hasil utama/agresif dari hasil analisis Limit Pullback.

## Fix
- Patch Limit Pullback sekarang selalu dianggap meta-only ketika tidak ada result utama.
- Limit TP1/BE/SL/TP Max tidak boleh mengubah `result`, `status`, `closedAt`, atau `resultPrice` utama agresif.
- History utama tetap berjalan sampai entry agresif benar-benar kena TP Max, SL, BE, atau expired normal.
- Analytics limit tetap menghitung `pullbackLimitResult`, `pullbackLimitTriggered`, `pullbackLimitTp1Hit`, dan `pullbackLimitBeActive` secara terpisah.

## Strategi utama tidak berubah
- M1 EMA Cross Direct Entry
- Entry agresif + Limit Pullback EMA
- Aggressive TP Max RR 1:1.25
- Limit TP Max RR 1:1
- TP1 -> BE
