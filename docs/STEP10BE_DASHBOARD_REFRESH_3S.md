# Step 10BE — Dashboard Refresh 3 Detik

Update ini mempercepat pembaruan dashboard premium agar data MT5/VPS terasa lebih realtime.

## Perubahan

- Live dashboard refresh dari interval lama menjadi 3 detik saat feed MT5/VPS sehat.
- Jika feed MT5/VPS stale, refresh diperlambat ke 30 detik agar Firebase RTDB tetap aman.
- Chart M1 refresh dibuat 30 detik untuk menjaga tampilan tetap ringan.
- Status Auto Result refresh tiap 30 detik.
- Dashboard menampilkan info `Auto Refresh: 3 detik` atau `30 detik` sesuai kondisi feed.
- Copy Auto Result diperjelas: dashboard refresh cepat, tetapi hasil TP/SL/BE tetap mengikuti jadwal cron/Update Hasil.

## Catatan

Refresh dashboard tidak mengubah strategi. Cron TP/SL/BE tetap membutuhkan endpoint result tracker berjalan. Jika cron hosting masih 1 menit sekali, hasil akhir bisa tetap telat sampai cron berikutnya, walaupun harga live dashboard sudah update tiap 3 detik.
