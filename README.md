# XAU AI Signal Gen Z

Web dashboard AI signal XAUUSD berbasis Cloudflare Pages Functions + KV + MT5.

## Cloudflare Pages build setting

Build command:

```txt
npm run build
```

Output directory:

```txt
dist
```

## Environment Variables

Tambahkan di Cloudflare Pages -> Settings -> Environment variables:

```txt
AI_API_KEY = API Groq kamu
AI_MODEL = llama3-70b-8192
```

## KV Binding

Tambahkan di Cloudflare Pages -> Settings -> Functions -> KV namespace bindings:

```txt
SIGNALS_KV
```

## API

```txt
/api/signal
/api/history
```

## MT5

Copy file ini ke folder MT5:

```txt
mt5/XAU_AI_SIGNAL.mq5
```

Lalu allow WebRequest domain Cloudflare Pages kamu.

## Disclaimer

Ini alat bantu analisis, bukan jaminan profit. Test demo dulu.
