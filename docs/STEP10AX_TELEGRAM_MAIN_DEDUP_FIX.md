# Step 10AX — Telegram Main Signal Dedup Fix

Update ini memperbaiki kasus sinyal utama terkirim 2x ke Telegram.

## Yang diubah

- `/api/signal` sekarang menyimpan `callHistory` lebih dulu sebelum mengirim Telegram.
- Telegram hanya dikirim jika `callHistory` benar-benar baru dibuat.
- Jika sinyal yang sama sudah ada di history, Telegram akan skip.
- Ditambah atomic Firebase ETag lock untuk mencegah request paralel mengirim alert dobel.
- Lock Telegram tetap memakai duplicate window agar refresh dashboard/cron cepat tidak spam.

## Efek

Satu sinyal utama M1 EMA Cross Direct Entry hanya mengirim satu alert Telegram untuk signalId/callId yang sama.

## Catatan

Strategi tidak berubah. Update ini hanya memperkuat anti-duplikat Telegram alert utama.
