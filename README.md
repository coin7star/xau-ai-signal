# XAU AI Signal GenZ

Web berbasis AI untuk bantu analisis sinyal XAUUSD, jalan di Cloudflare Workers + KV. MT5/MetaEditor mengirim snapshot market ke endpoint Worker, lalu AI membuat sinyal BUY/SELL/WAIT. Nanti kalau sudah punya dana, polling dari MT5 ini bisa diganti ke VPS/bot bridge.

> Penting: ini alat bantu edukasi/analisis, bukan jaminan profit. Selalu backtest, pakai akun demo dulu, dan batasi risiko.

## Isi project

- `src/index.js` — Cloudflare Worker API + dashboard web.
- `public/app.js` — logic frontend dashboard.
- `public/style.css` — tampilan Gen Z.
- `mt5/XauAiSignalBridge.mq5` — Expert Advisor MetaEditor MT5 untuk kirim data XAUUSD ke Worker.
- `wrangler.toml` — konfigurasi Cloudflare.
- `.env.example` — contoh ENV.

## ENV Cloudflare

Set di Cloudflare Worker dashboard:

```env
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=isi_api_key_ai
AI_MODEL=gpt-4o-mini
APP_SECRET=ganti_secret_panjang
```

Bisa juga pakai API OpenAI-compatible lain, misalnya endpoint Groq/OpenRouter/DeepSeek compatible chat completions.

## KV

Buat KV namespace, lalu binding dengan nama:

```txt
SIGNALS_KV
```

## Cara kerja sederhana

1. EA MT5 baca harga XAUUSD + indikator sederhana.
2. EA kirim POST ke `/api/mt5/tick`.
3. Worker panggil AI API untuk membuat sinyal.
4. Hasil disimpan ke KV.
5. Dashboard baca sinyal dari `/api/signal?symbol=XAUUSD`.

## Setting MT5

Di MT5:

1. Buka `Tools > Options > Expert Advisors`.
2. Centang `Allow WebRequest for listed URL`.
3. Tambahkan URL Worker kamu, contoh:
   `https://xau-ai-signal-genz.nama-user.workers.dev`
4. Buka MetaEditor.
5. Paste file `mt5/XauAiSignalBridge.mq5`.
6. Compile.
7. Attach EA ke chart `XAUUSD` timeframe M5/M15.
8. Isi input:
   - `ApiBaseUrl`: URL Worker kamu.
   - `AppSecret`: sama dengan ENV `APP_SECRET`.

## Endpoint

### GET `/`

Dashboard web.

### GET `/api/health`

Cek status Worker.

### GET `/api/signal?symbol=XAUUSD`

Ambil sinyal terakhir.

### POST `/api/mt5/tick`

Dipakai EA MT5. Header wajib:

```txt
x-app-secret: APP_SECRET
```

Body contoh:

```json
{
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "bid": 2350.12,
  "ask": 2350.35,
  "rsi": 52.1,
  "emaFast": 2348.9,
  "emaSlow": 2346.2,
  "atr": 2.8,
  "spreadPoints": 23
}
```

## Format sinyal AI

AI dipaksa balas JSON:

```json
{
  "symbol": "XAUUSD",
  "action": "BUY|SELL|WAIT",
  "confidence": 0-100,
  "entry": 0,
  "stopLoss": 0,
  "takeProfit1": 0,
  "takeProfit2": 0,
  "reason": "alasan singkat",
  "riskNote": "catatan risiko"
}
```

## Next upgrade kalau sudah VPS

- VPS menjalankan bridge Node/Python agar data tick lebih stabil.
- Tambah Telegram bot auto-notify sinyal.
- Tambah database D1 untuk riwayat sinyal panjang.
- Tambah scheduler news filter NFP/CPI/FOMC.
- Tambah panel winrate hasil backtest.
