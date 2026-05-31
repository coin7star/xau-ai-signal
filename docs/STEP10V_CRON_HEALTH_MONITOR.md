# Step 10V — Auto Result Cron Health Monitor

Fitur ini menambahkan monitor cron auto result langsung di dashboard.

## Tujuan
- Melihat apakah PHP.ID cron masih jalan.
- Melihat status terakhir Auto Result Engine.
- Memastikan result tetap memakai MT5/VPS live feed, bukan Bybit.
- Melihat alasan skip seperti `MT5_FEED_NOT_FRESH`.

## Endpoint baru

```txt
GET /api/result-cron-status
```

Endpoint ini membaca status dari Firebase path:

```txt
/xauusd/system/resultTrackerCron
```

## Status
- Online: cron baru berjalan dan status terakhir OK.
- Standby: cron aktif, tapi menunggu MT5/VPS feed fresh.
- Attention: cron belum update cukup lama.

## Catatan
Bybit tidak dipakai untuk menghitung WIN/LOSS/EXPIRED.
