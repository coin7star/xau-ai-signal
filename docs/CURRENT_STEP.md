# Step 10BZ — Reset Analytics Controls

Update ini menambahkan kontrol reset analisis tanpa menghapus history trade.

## Fitur

- Reset Analisis Limit Pullback mulai dari waktu sekarang.
- Reset Semua Analisis mulai dari waktu sekarang.
- History sinyal tetap aman dan tidak dihapus.
- Reset disimpan di Firebase path `/xauusd/analyticsReset`.
- Panel performa 7D/30D membaca data hanya setelah waktu reset.

## Analisis yang terdampak

### Reset Limit

Hanya panel Analisis Limit Pullback yang mulai dari 0 lagi.

### Reset Semua Analisis

Panel berikut mulai hitung dari waktu reset:

- Performa 7/30 Hari
- Analisis TP1 & BE
- Analisis Limit Pullback

## Catatan

Reset ini tidak menghapus history trade. Untuk menghapus history trade, harus dilakukan manual di Firebase, tetapi tidak disarankan karena data WR dan evaluasi strategi akan hilang.
