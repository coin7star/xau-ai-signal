CARA PASANG MT5:

1. Buka MetaTrader 5.
2. File -> Open Data Folder.
3. Masuk MQL5/Experts.
4. Copy XAU_AI_SIGNAL.mq5 ke folder Experts.
5. Buka MetaEditor, compile file tersebut.
6. Di MT5 buka Tools -> Options -> Expert Advisors.
7. Centang Allow WebRequest for listed URL.
8. Tambahkan domain Cloudflare Pages kamu, contoh:
   https://xau-ai-signal.pages.dev
9. Drag EA ke chart XAUUSD.
10. Ganti input SignalURL jadi:
   https://domain-kamu.pages.dev/api/signal
