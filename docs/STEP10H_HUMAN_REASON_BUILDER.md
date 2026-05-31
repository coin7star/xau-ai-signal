# Step 10H - Human-readable Reason Builder

Step ini fokus membuat alasan signal lebih mudah dipahami pemula.

## Yang berubah

### 1. API `/api/signal`
Response signal sekarang menambahkan field baru:

```json
{
  "reason": "Kalimat analisa manusiawi...",
  "reasonDetails": {
    "version": "10H-human-readable-reason-builder",
    "title": "Belum ada CALL valid.",
    "summary": "...",
    "action": "Aksi: tunggu ...",
    "direction": "WAIT",
    "bias": "Bias utama masih bearish...",
    "checklist": [
      "EMA: ...",
      "RSI: ...",
      "MFI: ...",
      "OB M15: ...",
      "Risk: ..."
    ],
    "blockers": [
      "EMA belum cross atau mendekati cross",
      "harga belum dekat OB M15 valid"
    ],
    "score": {
      "buy": 42,
      "sell": 58,
      "confidence": 55
    },
    "raw": []
  }
}
```

### 2. Dashboard
Panel signal utama menampilkan box baru:

- AI Reason Builder
- checklist alasan signal
- Yang ditunggu / blockers

### 3. Rule utama tidak diubah
Step ini hanya memperbaiki bahasa analisa. Rule CALL utama tetap sama:

- EMA 9/20 cross atau ready
- RSI cocok
- MFI cocok
- harga dekat OB M15 valid/fresh

## Tujuan

Sebelumnya alasan signal terlalu teknis dan terasa seperti log mesin. Sekarang user bisa membaca seperti analisa trader:

- arah trend utama
- indikator mana yang sudah mendukung
- indikator mana yang belum cocok
- apa yang harus ditunggu sebelum CALL
- risiko volatilitas berdasarkan ATR

## Catatan deploy

1. Upload semua file ke GitHub.
2. Redeploy Cloudflare Pages.
3. Buka dashboard.
4. Refresh signal.
5. Cek box `AI Reason Builder` di panel signal utama.

Tidak perlu update MQ5 untuk Step 10H ini.
Tidak perlu update cron Bybit untuk Step 10H ini.
