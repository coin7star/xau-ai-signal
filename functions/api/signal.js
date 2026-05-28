export async function onRequest({ env }) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  let market = null;

  if (dbUrl) {
    const res = await fetch(`${dbUrl}/xauusd/latest.json?ts=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" }
    });
    if (res.ok) market = await res.json();
  }

  const candles = Array.isArray(market?.candles) ? market.candles : [];
  const signal = buildSignal(candles, market);

  return json(signal);
}

export function buildSignal(candles, market) {
  const cleanCandles = clean(candles);
  const closes = cleanCandles.map((c) => c.close);
  const last = cleanCandles[cleanCandles.length - 1];

  if (!last || closes.length < 50) {
    return {
      ok: true,
      pair: "XAUUSD",
      signal: "WAIT",
      entry: round(market?.bid || 0),
      sl: 0,
      tp: 0,
      confidence: 50,
      reason: "Menunggu minimal 50 candle untuk RSI, EMA Cross 9/20, dan SMC Order Block v2.",
      mode: market ? "firebase-mt5-data" : "waiting-mt5",
      strategy: {
        trendBias: "Netral",
        rsi: null,
        rsiMethod: "Wilder RSI 14 seperti MT5 iRSI",
        ema9: null,
        ema20: null,
        emaCross: "WAIT",
        smc: null,
        orderBlock: null,
        buyScore: 0,
        sellScore: 0,
        score: 0
      }
    };
  }

  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const prevEma9 = ema(closes.slice(0, -1), 9);
  const prevEma20 = ema(closes.slice(0, -1), 20);
  const rsi14 = rsiWilder(closes, 14);
  const atr14 = atr(cleanCandles, 14);

  const close = last.close;
  const high = last.high;
  const low = last.low;

  const smc = detectSmcOrderBlockV2(cleanCandles);
  const bullOb = smc?.bullish;
  const bearOb = smc?.bearish;

  const nearBullOB = bullOb && bullOb.status !== "invalid" && close >= bullOb.low - atr14 * 0.35 && close <= bullOb.high + atr14 * 0.85;
  const nearBearOB = bearOb && bearOb.status !== "invalid" && close <= bearOb.high + atr14 * 0.35 && close >= bearOb.low - atr14 * 0.85;

  let emaCross = "NEUTRAL";
  if (prevEma9 <= prevEma20 && ema9 > ema20) emaCross = "BULLISH_CROSS";
  else if (prevEma9 >= prevEma20 && ema9 < ema20) emaCross = "BEARISH_CROSS";
  else if (ema9 > ema20) emaCross = "BULLISH_TREND";
  else if (ema9 < ema20) emaCross = "BEARISH_TREND";

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (ema9 > ema20) { buyScore += 22; reasons.push("EMA 9 di atas EMA 20, trend pendek bullish."); }
  if (ema9 < ema20) { sellScore += 22; reasons.push("EMA 9 di bawah EMA 20, trend pendek bearish."); }

  if (emaCross === "BULLISH_CROSS") { buyScore += 24; reasons.push("EMA 9 baru cross ke atas EMA 20."); }
  if (emaCross === "BEARISH_CROSS") { sellScore += 24; reasons.push("EMA 9 baru cross ke bawah EMA 20."); }

  if (rsi14 >= 55 && rsi14 <= 72) { buyScore += 16; reasons.push(`RSI Wilder ${round(rsi14)} mendukung BUY.`); }
  if (rsi14 <= 45 && rsi14 >= 28) { sellScore += 16; reasons.push(`RSI Wilder ${round(rsi14)} mendukung SELL.`); }
  if (rsi14 > 72) { sellScore += 8; reasons.push(`RSI Wilder ${round(rsi14)} mulai overbought.`); }
  if (rsi14 < 28) { buyScore += 8; reasons.push(`RSI Wilder ${round(rsi14)} mulai oversold.`); }

  if (smc?.lastBos?.type === "BULLISH_BOS") { buyScore += 18; reasons.push("SMC mendeteksi Bullish BOS."); }
  if (smc?.lastBos?.type === "BEARISH_BOS") { sellScore += 18; reasons.push("SMC mendeteksi Bearish BOS."); }

  if (nearBullOB) { buyScore += 20; reasons.push(`Harga dekat Bullish OB v2 (${bullOb.status}).`); }
  if (nearBearOB) { sellScore += 20; reasons.push(`Harga dekat Bearish OB v2 (${bearOb.status}).`); }

  if (bullOb?.status === "active") buyScore += Math.min(10, bullOb.strength / 10);
  if (bearOb?.status === "active") sellScore += Math.min(10, bearOb.strength / 10);

  if (close > high - atr14 * 0.35) buyScore += 6;
  if (close < low + atr14 * 0.35) sellScore += 6;

  let finalSignal = "WAIT";
  const score = Math.max(buyScore, sellScore);

  if (buyScore >= 58 && buyScore > sellScore + 8) finalSignal = "BUY";
  else if (sellScore >= 58 && sellScore > buyScore + 8) finalSignal = "SELL";

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

  const trendBias = ema9 > ema20 ? "Bullish" : ema9 < ema20 ? "Bearish" : "Netral";

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    entry: round(entry),
    sl: round(sl),
    tp: round(tp),
    confidence,
    reason: reasons.slice(0, 6).join(" "),
    mode: "firebase-mt5-data",
    strategy: {
      trendBias,
      rsi: round(rsi14),
      rsiMethod: "Wilder RSI 14 seperti MT5 iRSI",
      ema9: round(ema9),
      ema20: round(ema20),
      emaCross,
      smc,
      orderBlock: {
        bullish: bullOb,
        bearish: bearOb
      },
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score)
    }
  };
}

function clean(candles) {
  return (candles || [])
    .map((c, index) => ({
      index,
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }))
    .filter((c) =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    );
}

function detectSmcOrderBlockV2(candles) {
  const data = candles.slice(-140);
  const atr14 = atr(data, 14);
  const swings = detectSwings(data, 2);
  const bosEvents = detectBosEvents(data, swings, atr14);

  let bullish = null;
  let bearish = null;

  for (const bos of bosEvents) {
    if (bos.type === "BULLISH_BOS") {
      const origin = findOriginCandle(data, bos.index, "bullish");
      if (origin) bullish = buildObZone(data, bos, origin, "bullish", atr14);
    }

    if (bos.type === "BEARISH_BOS") {
      const origin = findOriginCandle(data, bos.index, "bearish");
      if (origin) bearish = buildObZone(data, bos, origin, "bearish", atr14);
    }
  }

  bullish = bullish ? updateObStatus(data, bullish, "bullish", atr14) : null;
  bearish = bearish ? updateObStatus(data, bearish, "bearish", atr14) : null;

  const lastBos = bosEvents[bosEvents.length - 1] || null;

  return {
    version: "SMC_OB_V2",
    swingLookback: 2,
    bosCount: bosEvents.length,
    lastBos,
    bullish,
    bearish
  };
}

function detectSwings(data, wing = 2) {
  const swings = [];

  for (let i = wing; i < data.length - wing; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = i - wing; j <= i + wing; j++) {
      if (j === i) continue;
      if (data[i].high <= data[j].high) isHigh = false;
      if (data[i].low >= data[j].low) isLow = false;
    }

    if (isHigh) swings.push({ type: "swingHigh", index: i, price: data[i].high, time: data[i].time });
    if (isLow) swings.push({ type: "swingLow", index: i, price: data[i].low, time: data[i].time });
  }

  return swings;
}

function detectBosEvents(data, swings, atr14) {
  const events = [];
  let lastHigh = null;
  let lastLow = null;

  for (let i = 0; i < data.length; i++) {
    const swingAtI = swings.filter((s) => s.index === i);
    for (const s of swingAtI) {
      if (s.type === "swingHigh") lastHigh = s;
      if (s.type === "swingLow") lastLow = s;
    }

    const c = data[i];

    if (lastHigh && i > lastHigh.index + 1 && c.close > lastHigh.price + atr14 * 0.05) {
      events.push({
        type: "BULLISH_BOS",
        index: i,
        time: c.time,
        breakPrice: round(lastHigh.price),
        close: round(c.close),
        brokenSwingTime: lastHigh.time
      });
      lastHigh = null;
    }

    if (lastLow && i > lastLow.index + 1 && c.close < lastLow.price - atr14 * 0.05) {
      events.push({
        type: "BEARISH_BOS",
        index: i,
        time: c.time,
        breakPrice: round(lastLow.price),
        close: round(c.close),
        brokenSwingTime: lastLow.time
      });
      lastLow = null;
    }
  }

  return events;
}

function findOriginCandle(data, bosIndex, direction) {
  const start = Math.max(0, bosIndex - 12);
  const end = bosIndex - 1;
  let candidate = null;

  for (let i = end; i >= start; i--) {
    const c = data[i];
    const body = Math.abs(c.close - c.open);
    const range = Math.max(0.01, c.high - c.low);
    const bodyRatio = body / range;

    if (direction === "bullish") {
      const isBear = c.close < c.open;
      if (isBear) {
        candidate = { ...c, bodyRatio: round(bodyRatio), originIndex: i };
        break;
      }
    }

    if (direction === "bearish") {
      const isBull = c.close > c.open;
      if (isBull) {
        candidate = { ...c, bodyRatio: round(bodyRatio), originIndex: i };
        break;
      }
    }
  }

  return candidate;
}

function buildObZone(data, bos, origin, direction, atr14) {
  const displacement = Math.abs(data[bos.index].close - origin.close);
  const displacementAtr = displacement / Math.max(0.01, atr14);

  const strength = Math.min(95, Math.max(45,
    45 +
    displacementAtr * 14 +
    origin.bodyRatio * 20
  ));

  return {
    type: direction === "bullish" ? "Bullish OB v2" : "Bearish OB v2",
    direction,
    low: round(origin.low),
    high: round(origin.high),
    originTime: origin.time,
    bosTime: bos.time,
    bosType: bos.type,
    breakPrice: bos.breakPrice,
    status: "active",
    mitigated: false,
    invalidated: false,
    strength: round(strength),
    reason: `${bos.type} setelah origin candle ${direction === "bullish" ? "bearish" : "bullish"}`
  };
}

function updateObStatus(data, ob, direction, atr14) {
  let status = "active";
  let mitigated = false;
  let invalidated = false;
  let mitigatedTime = null;
  let invalidatedTime = null;

  const afterOrigin = data.filter((c) => timeToNum(c.time) > timeToNum(ob.originTime));

  for (const c of afterOrigin) {
    const touched = c.low <= ob.high && c.high >= ob.low;

    if (touched) {
      mitigated = true;
      mitigatedTime = mitigatedTime || c.time;
    }

    if (direction === "bullish" && c.close < ob.low - atr14 * 0.1) {
      invalidated = true;
      invalidatedTime = c.time;
      break;
    }

    if (direction === "bearish" && c.close > ob.high + atr14 * 0.1) {
      invalidated = true;
      invalidatedTime = c.time;
      break;
    }
  }

  if (invalidated) status = "invalid";
  else if (mitigated) status = "mitigated";
  else status = "active";

  return {
    ...ob,
    status,
    mitigated,
    invalidated,
    mitigatedTime,
    invalidatedTime
  };
}

function timeToNum(value) {
  const raw = String(value || "").replace(/\./g, "-").replace(" ", "T");
  const n = Date.parse(raw);
  return Number.isNaN(n) ? 0 : n;
}

function ema(values, period) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = values[i] * k + result * (1 - k);
  return result;
}

function rsiWilder(values, period = 14) {
  if (values.length <= period) return 50;
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
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
    trs.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    ));
  }

  const sum = trs.reduce((a, b) => a + b, 0);
  return trs.length ? sum / trs.length : 1;
}

function round(n) {
  return Number(Number(n || 0).toFixed(2));
}

function json(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
