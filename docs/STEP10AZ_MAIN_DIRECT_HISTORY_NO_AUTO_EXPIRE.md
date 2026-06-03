# STEP10AZ — Main Direct History No Auto Expire

## Tujuan
Fix bug sinyal utama M1 EMA Cross Direct Entry yang lama berubah menjadi EXPIRED ketika muncul sinyal BUY/SELL baru.

## Perubahan
- Sinyal utama direct entry sekarang disimpan sebagai `OPEN`, bukan `PENDING`.
- Type history utama menjadi `MAIN_M1_EMA_CROSS_DIRECT_ENTRY`.
- Sinyal lama tidak ditutup/expired otomatis hanya karena sinyal baru muncul.
- Auto result tetap memantau sinyal lama sampai kena TP Max, SL, BE setelah TP1, atau expire waktu normal.
- Result tracker punya migrasi aman: record lama yang masih `PENDING` tapi sebenarnya direct entry akan dinaikkan menjadi `OPEN` saat cron scan berikutnya.

## Tidak berubah
- Strategi utama tetap M1 EMA Cross Direct Entry.
- Telegram alert tetap dedup.
- UI premium copy tetap dari Step 10AY.
