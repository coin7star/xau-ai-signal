# Step 10L — Weekend / Market Closed Friendly Mode

Patch ini membuat dashboard lebih ramah saat XAU/forex sedang tutup, terutama Sabtu–Minggu.

## Tujuan

Sebelumnya, saat live feed stale, dashboard terlihat seperti koneksi error. Padahal saat weekend, market memang tidak mengirim tick baru.

Step 10L membedakan dua kondisi:

1. **Market Session Paused**  
   Dipakai saat weekend. Dashboard menjelaskan bahwa market sedang jeda dan chart menampilkan candle terakhir yang tersimpan.

2. **Live Feed Reconnecting**  
   Dipakai saat bukan weekend tetapi data live telat/terputus.

## Perubahan utama

- Header status lebih user friendly.
- Banner stale data berubah sesuai kondisi market.
- Chart M1/M15 diberi notice kalau hanya menampilkan candle terakhir.
- Empty state chart saat market tutup lebih jelas.
- Tidak mengubah MQ5, Firebase, Telegram, atau logic signal.

## Catatan

EA/MT5 yang memakai `OnTick()` memang tidak akan mengirim update baru saat market tutup karena tidak ada tick. Dashboard tetap aman karena candle terakhir akan tetap ditampilkan kalau datanya masih tersedia.
