export async function onRequest({ env }) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  let market = null;

  if (dbUrl) {
    const res = await fetch(`${dbUrl}/xauusd/latest.json`);
    if (res.ok) market = await res.json();
  }

  const candles = market?.candles || [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  let signal = "WAIT", confidence = 55, entry = market?.bid || 0, sl = 0, tp = 0;
  let reason = "Menunggu data candle dari MT5.";

  if (last && prev) {
    const up = Number(last.close) > Number(prev.close);
    const range = Math.abs(Number(last.high) - Number(last.low)) || 1;
    const body = Math.abs(Number(last.close) - Number(last.open));
    confidence = Math.min(92, Math.max(60, Math.round(60 + (body / range) * 30)));
    signal = up ? "BUY" : "SELL";
    entry = Number(last.close);
    if (signal === "BUY") {
      sl = Number(last.low);
      tp = entry + Math.abs(entry - sl) * 1.7;
      reason = "Candle terakhir bullish, momentum pendek condong BUY.";
    } else {
      sl = Number(last.high);
      tp = entry - Math.abs(sl - entry) * 1.7;
      reason = "Candle terakhir bearish, momentum pendek condong SELL.";
    }
  }

  return j({ ok: true, pair: "XAUUSD", signal, entry: r(entry), sl: r(sl), tp: r(tp), confidence, reason, mode: market ? "firebase-mt5-data" : "waiting-mt5" });
}
function r(n){ return Number(Number(n || 0).toFixed(2)); }
function j(payload){ return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
