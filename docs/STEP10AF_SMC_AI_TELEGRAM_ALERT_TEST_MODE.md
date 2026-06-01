# Step 10AF — SMC AI Telegram Alert Test Mode

Patch ini menambahkan test alert Telegram khusus Strategy B / SMC AI di panel Admin.

## Tujuan

- Test format alert BUY dan SELL untuk SMC AI.
- Kirim hanya ke Telegram global/admin (`TELEGRAM_CHAT_ID`).
- Tidak mengubah history Strategy B.
- Tidak mengirim ke user premium.
- Tidak mengaktifkan SMC AI sebagai signal utama.

## Endpoint baru

`POST /api/strategy-b-alert-test`

Body:

```json
{
  "direction": "BUY"
}
```

atau:

```json
{
  "direction": "SELL"
}
```

Harus memakai admin token melalui header:

```txt
Authorization: Bearer ADMIN_ACTION_TOKEN
```

## ENV opsional

```env
STRATEGY_B_TELEGRAM_TEST_ENABLED=true
STRATEGY_B_ALERT_TEST_COOLDOWN_SEC=20
```

Jika `STRATEGY_B_TELEGRAM_TEST_ENABLED=false`, tombol test akan ditolak oleh endpoint.

## Dashboard

Panel baru tersedia di:

`Admin → SMC AI Alert Test`

Tombol:

- Test SMC BUY
- Test SMC SELL

## Catatan

Step ini hanya admin test mode. Multi-user premium alert untuk SMC AI belum aktif.
