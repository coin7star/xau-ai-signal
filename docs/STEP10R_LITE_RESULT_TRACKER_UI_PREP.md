# Step 10R Lite — Result Tracker UI Prep

Step ini menyiapkan tampilan dan struktur UI untuk tracking hasil signal sebelum auto result engine penuh diaktifkan.

Perubahan utama:
- Tambah panel `Result Tracker Lite` di tab History.
- Ringkasan Running Signal, Closed Signal, dan Live Price Check.
- Status `OPEN` ditampilkan lebih user friendly sebagai `RUNNING`.
- Tambah badge `RUNNING` dan `EXPIRED` untuk persiapan auto tracker berikutnya.
- Tidak mengubah logic entry, MQ5, Firebase rules, Telegram alert, atau Bybit cron.

Mode ini masih UI prep. Auto WIN/LOSS penuh disarankan masuk Step 10S.
