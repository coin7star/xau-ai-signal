# Step 10Z — Auto Signal Multi-user Dry Run

Step ini menambahkan simulasi penerima auto signal multi-user tanpa mengirim pesan Telegram.

## Tujuan

Sebelum multi-user alert live diaktifkan, admin bisa melihat siapa yang eligible menerima auto signal dan siapa yang diskip.

## Endpoint

`POST /api/telegram-multi-user-dry-run`

Proteksi: `ADMIN_ACTION_TOKEN`.

## Filter eligible

User dianggap siap menerima auto signal jika:
- role premium aktif atau admin
- Telegram connected
- alertEnabled tidak OFF
- Main Signal Alert ON
- Chat ID tidak duplikat

## Catatan

Dry run tidak mengirim pesan Telegram. Fitur ini hanya simulasi aman untuk persiapan Step 11 multi-user alert live.
