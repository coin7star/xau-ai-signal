# Step 10W — Performance Analytics Upgrade

Upgrade panel Performance Analytics yang sudah ada.

## Perubahan
- Menambahkan EXPIRED ke statistik 7/30 hari.
- Menampilkan Clean WR dan Total WR.
- Best Snapshot sekarang bisa tampil meskipun data closed masih sedikit.
- Copywriting disesuaikan dengan Auto Result Engine dan Auto Result Cron.
- RUNNING tidak masuk hitungan winrate.

## Definisi
- Clean WR = WIN / (WIN + LOSS + BE)
- Total WR = WIN / (WIN + LOSS + BE + EXPIRED)
- EXPIRED dipisah agar kualitas setup yang habis waktu tetap terlihat.
