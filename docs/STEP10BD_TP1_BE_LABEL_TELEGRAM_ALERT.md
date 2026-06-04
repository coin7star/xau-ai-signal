# STEP10BD - TP1 BE Label + Telegram Alert

Update ini merapikan proses TP1 pada Auto Result:

- Saat harga menyentuh TP1, cron tetap membuat sinyal berjalan.
- SL / batas risiko dipindahkan otomatis ke harga entry.
- Dashboard menampilkan status `TP1 kena · BE aktif`.
- Kolom Risiko / Target berubah dari `SL / TP Max` menjadi `BE Entry / TP Max`.
- Telegram mengirim notifikasi TP1 sekali saja per sinyal.
- Result akhir tetap menunggu salah satu kondisi berikut:
  - TP Max = WIN / Menang
  - Harga kembali ke entry setelah TP1 = BE
  - SL awal tersentuh sebelum TP1 = LOSS / Kalah
  - Melewati batas waktu = EXPIRED / Kedaluwarsa

ENV tambahan opsional:

```txt
TP1_ALERT_ENABLED=true
```

Kalau ENV ini tidak diisi, default tetap aktif.
