# STEP 10BF - Result Tracker Active Count Sync

Fix sinkronisasi angka sinyal aktif antara panel Auto Result dan Riwayat Sinyal.

## Perubahan

- Panel Auto Result sekarang menghitung semua sinyal utama yang masih berjalan, bukan hanya 5 item pertama yang tampil di list.
- Daftar Auto Result menampilkan sampai 12 sinyal aktif utama. Jika lebih dari 12, sinyal lain tetap dipantau cron dan diberi keterangan.
- Scalp lama tidak ikut dihitung di panel Auto Result karena strategi aktif sekarang hanya sinyal utama M1 EMA Cross.
- Backend result tracker tidak boleh dibatasi terlalu kecil. `RESULT_TRACKER_MAX_ITEMS` sekarang minimal 50 dan maksimal 200 supaya semua posisi M1 yang masih berjalan ikut discan.
- Response tracker menambahkan `totalOpenCount` dan `maxItems` untuk debugging/admin.

## Tujuan

Angka di Auto Result, queue cron, dan history tidak beda lagi saat ada lebih dari 5 sinyal berjalan.
