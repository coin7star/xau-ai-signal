# STEP 10BC — Auto BE TP1 Cron Fix

Update auto result tracker untuk strategi utama M1 EMA Cross Direct Entry.

## Perubahan

- Cron auto result sekarang otomatis mengaktifkan BE saat harga menyentuh TP1.
- Saat TP1 tercapai, history sinyal tetap `OPEN / Berjalan`, bukan ditutup.
- Field yang disimpan:
  - `tp1Hit: true`
  - `tp1HitAt`
  - `breakEvenActive: true`
  - `beActive: true`
  - `bePrice: entry`
  - `breakEvenPrice: entry`
  - `originalSl`
  - `sl: entry`
- Setelah BE aktif:
  - BUY menjadi BE jika harga turun balik ke entry.
  - SELL menjadi BE jika harga naik balik ke entry.
- TP Max tetap diprioritaskan sebagai WIN jika harga langsung menyentuh TP Max.
- Fallback TP1 ditambahkan bila history lama tidak punya field `tp1`:
  - BUY: `entry + 50% jarak ke TP Max`
  - SELL: `entry - 50% jarak ke TP Max`

## Catatan

Fix ini tidak mengubah strategi entry. Yang berubah hanya cara cron mengamankan posisi setelah TP1.
