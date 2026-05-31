# Step 10U1 — Cron Security Hardening

Patch ini mengamankan Auto Result Cron Runner.

## Perubahan

- Cloudflare endpoint `/api/result-tracker-cron` sekarang hanya menerima `POST`.
- Secret tidak lagi dikirim lewat query URL Cloudflare.
- PHP runner mengirim secret lewat header `x-result-cron-secret`.
- PHP runner public wajib memakai token `?runner=` supaya tidak bisa dipanggil sembarang orang.
- CORS endpoint cron dibatasi ke domain dashboard resmi.
- Result tetap memakai live feed utama MT5/VPS dari `/xauusd/latest`, bukan Bybit.

## Cron command baru

```bash
curl -s "https://xauaisignal.co-id.id/result-tracker-cron-runner.php?runner=genzrun2026" >/dev/null 2>&1
```

## Secret

Cloudflare ENV harus tetap ada:

```env
RESULT_TRACKER_CRON_SECRET=genzxau2026
```

Jika token runner di PHP diganti, samakan bagian `?runner=` di cron command.
