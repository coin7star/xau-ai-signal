# Step 10AE1 — Separate M1 Scalp from Strategy A Compare

Patch ini memisahkan M1 Scalp dari perhitungan Strategy A pada panel Strategy Lab.

## Perubahan
- Strategy A di panel compare sekarang hanya menghitung Main Signal / CALL History.
- M1 Scalp tidak lagi dicampur ke Strategy A.
- M1 Scalp tetap berada di tab Scalp Mode dengan statistiknya sendiri.
- Strategy B / SMC AI tetap terpisah.
- Tambah catatan di panel Strategy Lab bahwa M1 Scalp dipisahkan.

## Tujuan
Agar perbandingan lebih bersih:

```txt
Strategy A = Main Signal Only
M1 Scalp = mode terpisah
Strategy B = SMC AI
```
