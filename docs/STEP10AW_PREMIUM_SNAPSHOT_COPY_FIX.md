# STEP10AW - Premium Snapshot Copy Fix

Update ini merapikan panel ringkasan market agar tidak menampilkan istilah internal seperti READY_BUY, LOW, WAIT DIRECT, atau label yang saling bentrok.

## Fix utama
- Row EMA sekarang menampilkan arah EMA M1 berdasarkan posisi EMA9 vs EMA20.
- Badge EMA tidak lagi memakai `mainM5.direction` saat status hanya ready/pantau.
- Kondisi seperti bearish trend + bullish badge sudah dicegah dari sisi copy UI.
- Label internal diganti menjadi bahasa premium user-friendly:
  - READY_BUY -> Pantau BUY
  - READY_SELL -> Pantau SELL
  - LOW -> Belum kuat
  - MEDIUM -> Cukup kuat
  - HIGH -> Kuat
  - BUY_OPEN -> BUY aktif
  - SELL_OPEN -> SELL aktif
- Panel entry hanya menampilkan harga entry ketika sinyal benar-benar aktif.
- Target dan risiko hanya tampil setelah rencana entry lengkap tersedia.

## Strategi tidak berubah
Rule utama tetap M1 EMA Cross Direct Entry.
