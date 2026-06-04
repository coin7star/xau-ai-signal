# Step 10CD — Aggressive BE Range Fix

Fix auto result agar sinyal utama/agresif tidak tiba-tiba menjadi BE hanya karena range candle sebelum TP1 ikut terbaca.

## Perubahan
- BE sinyal utama sekarang dicek dari range harga setelah TP1/BE aktif, bukan dari range sejak entry.
- TP1 tetap mengaktifkan BE dan memindahkan SL ke entry.
- Jika harga balik ke entry setelah BE aktif, baru hasil utama ditutup sebagai BE.
- Limit Pullback analytics tetap terpisah dari hasil utama/agresif.

## Strategi tetap
- Entry agresif M1 EMA Cross.
- Limit Pullback EMA untuk manual plan.
- SL smart swing anchor + buffer.
- TP agresif RR 1:1.25.
- TP limit RR 1:1.
