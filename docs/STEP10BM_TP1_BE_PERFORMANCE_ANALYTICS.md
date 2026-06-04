# STEP10BM — TP1 & BE Performance Analytics

## Tujuan
Menambahkan analisis performa khusus untuk alur strategi utama:

Entry → TP1 tersentuh → SL pindah BE → lanjut TP Max atau balik BE.

## Update
- Tambah panel **Analisis TP1 & BE** di area Performa 7/30 Hari.
- Menampilkan statistik 7 hari dan 30 hari:
  - Total sinyal
  - TP1 kena
  - TP Max
  - Balik BE
  - SL duluan
  - BE aktif
- TP1 Hit Rate dihitung dari sinyal yang sudah menyentuh TP1, sudah Menang, atau sudah BE.
- WIN dihitung sebagai sudah melewati TP1 karena TP Max berada setelah TP1.
- Direct loss membaca sinyal yang kalah sebelum TP1/BE aktif.

## Catatan
Logic strategi, SL nearest swing, RR 1:1.25, cron, Telegram, dan auto BE tidak diubah.
Update ini hanya menambah analytics dashboard agar strategi lebih mudah dievaluasi sebelum ganti rule.
