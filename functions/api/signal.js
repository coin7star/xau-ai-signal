export async function onRequest({ env }) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  let market = null;

  if (dbUrl) {
    const res = await fetch(`${dbUrl}/xauusd/latest.json`);
    if (res.ok) market = await res.json();
  }

  const candles = Array.isArray(market?.candles) ? market.candles : [];
  const signal = buildSignal(candles, market);

  return json(signal);
}

function buildSignal(candles, market) {
  const closes = candles.map((c) => Number(c.close)).filter(Number.isFinite);
  const last = candles[candles.length - 1];

  if (!last || closes.length < 30) {
    return {
      ok: true,
      pair: "XAUUSD",
      signal: "WAIT",
      entry: round(market?.bid || 0),
      sl: 0,
      tp: 0,
      confidence: 50,
      reason: "Menunggu minimal 30 candle untuk RSI, EMA Cross 9/20, dan Order Block.",
      mode: market ? "firebase-mt5-data" : "waiting-mt5",
      strategy: {
        rsi: null,
        ema9: null,
        ema20: null,
        emaCross: "WAIT",
        orderBlock: null,
        score: 0
      }
    };
  }

  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const prevEma9 = ema(closes.slice(0, -1), 9);
  const prevEma20 = ema(closes.slice(0, -1), 20);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);

  const close = Number(last.close);
  const high = Number(last.high);
  const low = Number(last.low);

  const orderBlock = detectOrderBlock(candles);
  const bullOb = orderBlock.bullish;
  const bearOb = orderBlock.bearish;

  const nearBullOB = bullOb && close >= bullOb.low - atr14 * 0.3 && close <= bullOb.high + atr14 * 0.8;
  const nearBearOB = bearOb && close <= bearOb.high + atr14 * 0.3 && close >= bearOb.low - atr14 * 0.8;

  let emaCross = "NEUTRAL";
  if (prevEma9 <= prevEma20 && ema9 > ema20) emaCross = "BULLISH_CROSS";
  else if (prevEma9 >= prevEma20 && ema9 < ema20) emaCross = "BEARISH_CROSS";
  else if (ema9 > ema20) emaCross = "BULLISH_TREND";
  else if (ema9 < ema20) emaCross = "BEARISH_TREND";

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (ema9 > ema20) {
    buyScore += 25;
    reasons.push("EMA 9 di atas EMA 20, trend pendek bullish.");
  }
  if (ema9 < ema20) {
    sellScore += 25;
    reasons.push("EMA 9 di bawah EMA 20, trend pendek bearish.");
  }

  if (emaCross === "BULLISH_CROSS") {
    buyScore += 25;
    reasons.push("EMA 9 baru cross ke atas EMA 20.");
  }
  if (emaCross === "BEARISH_CROSS") {
    sellScore += 25;
    reasons.push("EMA 9 baru cross ke bawah EMA 20.");
  }

  if (rsi14 >= 55 && rsi14 <= 72) {
    buyScore += 20;
    reasons.push(`RSI ${round(rsi14)} mendukung BUY.`);
  }
  if (rsi14 <= 45 && rsi14 >= 28) {
    sellScore += 20;
    reasons.push(`RSI ${round(rsi14)} mendukung SELL.`);
  }
  if (rsi14 > 72) {
    sellScore += 8;
    reasons.push(`RSI ${round(rsi14)} mulai overbought, hati-hati BUY.`);
  }
  if (rsi14 < 28) {
    buyScore += 8;
    reasons.push(`RSI ${round(rsi14)} mulai oversold, hati-hati SELL.`);
  }

  if (nearBullOB) {
    buyScore += 22;
    reasons.push("Harga dekat bullish order block.");
  }
  if (nearBearOB) {
    sellScore += 22;
    reasons.push("Harga dekat bearish order block.");
  }

  if (close > high - atr14 * 0.35) buyScore += 8;
  if (close < low + atr14 * 0.35) sellScore += 8;

  let finalSignal = "WAIT";
  let score = Math.max(buyScore, sellScore);
  if (buyScore >= 55 && buyScore > sellScore + 8) finalSignal = "BUY";
  else if (sellScore >= 55 && sellScore > buyScore + 8) finalSignal = "SELL";

  const entry = close;
  let sl = 0;
  let tp = 0;

  if (finalSignal === "BUY") {
    sl = bullOb ? Math.min(bullOb.low, close - atr14 * 1.1) : close - atr14 * 1.4;
    tp = close + Math.abs(close - sl) * 1.7;
  } else if (finalSignal === "SELL") {
    sl = bearOb ? Math.max(bearOb.high, close + atr14 * 1.1) : close + atr14 * 1.4;
    tp = close - Math.abs(sl - close) * 1.7;
  }

  const confidence = finalSignal === "WAIT"
    ? Math.min(62, Math.max(45, Math.round(score)))
    : Math.min(94, Math.max(60, Math.round(score)));

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    entry: round(entry),
    sl: round(sl),
    tp: round(tp),
    confidence,
    reason: reasons.slice(0, 5).join(" "),
    mode: "firebase-mt5-data",
    strategy: {
      rsi: round(rsi14),
      ema9: round(ema9),
      ema20: round(ema20),
      emaCross,
      orderBlock,
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score)
    }
  };
}

function ema(values, period) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let result = values[0];

  for (let i = 1; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }

  return result;
}

function rsi(values, period = 14) {
  if (values.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr(candles, period = 14) {
  if (candles.length < 2) return 1;
  const slice = candles.slice(-period - 1);
  const trs = [];

  for (let i = 1; i < slice.length; i++) {
    const current = slice[i];
    const prev = slice[i - 1];
    const high = Number(current.high);
    const low = Number(current.low);
    const prevClose = Number(prev.close);

    trs.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  const sum = trs.reduce((a, b) => a + b, 0);
  return trs.length ? sum / trs.length : 1;
}

function detectOrderBlock(candles) {
  const scan = candles.slice(-80);
  let bullish = null;
  let bearish = null;

  for (let i = 3; i < scan.length - 3; i++) {
    const c = scan[i];
    const next1 = scan[i + 1];
    const next2 = scan[i + 2];

    const open = Number(c.open);
    const close = Number(c.close);
    const high = Number(c.high);
    const low = Number(c.low);

    const nextMoveUp = Number(next2.close) > high;
    const nextMoveDown = Number(next2.close) < low;

    const bearishCandle = close < open;
    const bullishCandle = close > open;

    if (bearishCandle && nextMoveUp) {
      bullish = {
        type: "BULLISH_OB",
        low: round(low),
        high: round(high),
        originTime: c.time || null
      };
    }

    if (bullishCandle && nextMoveDown) {
      bearish = {
        type: "BEARISH_OB",
        low: round(low),
        high: round(high),
        originTime: c.time || null
      };
    }
  }

  return { bullish, bearish };
}

function round(n) {
  return Number(Number(n || 0).toFixed(2));
}

function json(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
