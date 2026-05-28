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
  const candlesM15 = Array.isArray(market?.candlesM15) ? market.candlesM15 : [];
  const signal = buildSignal(candles, candlesM15, market);

  return json(signal);
}

export function buildSignal(candles, candlesM15, market) {
  const m1 = clean(candles);
  const m15 = clean(candlesM15);
  const closes = m1.map((c) => c.close);
  const last = m1[m1.length - 1];

  if (!last || closes.length < 50) {
    return {
      ok: true,
      pair: "XAUUSD",
      signal: "WAIT",
      callStage: "WAITING_DATA",
      entry: round(market?.bid || 0),
      sl: 0,
      tp: 0,
      confidence: 50,
      reason: "Menunggu minimal 50 candle M1 untuk EMA ready/cross. OB M15 butuh data M15 dari EA.",
      mode: market ? "firebase-mt5-data" : "waiting-mt5",
      strategy: emptyStrategy()
    };
  }

  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const prevEma9 = ema(closes.slice(0, -1), 9);
  const prevEma20 = ema(closes.slice(0, -1), 20);
  const prev2Ema9 = ema(closes.slice(0, -2), 9);
  const prev2Ema20 = ema(closes.slice(0, -2), 20);

  const rsi14 = rsiWilder(closes, 14);
  const atr14 = atr(m1, 14);
  const close = last.close;

  const smc = m15.length >= 50 ? detectSmcOrderBlockV2(m15) : null;
  const bullOb = smc?.bullish || null;
  const bearOb = smc?.bearish || null;

  const gap = Math.abs(ema9 - ema20);
  const prevGap = Math.abs(prevEma9 - prevEma20);
  const prev2Gap = Math.abs(prev2Ema9 - prev2Ema20);
  const gapThreshold = Math.max(atr14 * 0.18, close * 0.00012);
  const gapClosing = gap < prevGap && prevGap <= prev2Gap * 1.25;

  const bullishCrossNow = prevEma9 <= prevEma20 && ema9 > ema20;
  const bearishCrossNow = prevEma9 >= prevEma20 && ema9 < ema20;

  const readyBuy = !bullishCrossNow && ema9 < ema20 && gap <= gapThreshold && gapClosing;
  const readySell = !bearishCrossNow && ema9 > ema20 && gap <= gapThreshold && gapClosing;

  let emaCross = "NEUTRAL";
  if (bullishCrossNow) emaCross = "BULLISH_CROSS";
  else if (bearishCrossNow) emaCross = "BEARISH_CROSS";
  else if (readyBuy) emaCross = "READY_BULLISH_CROSS";
  else if (readySell) emaCross = "READY_BEARISH_CROSS";
  else if (ema9 > ema20) emaCross = "BULLISH_TREND";
  else if (ema9 < ema20) emaCross = "BEARISH_TREND";

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (ema9 > ema20) buyScore += 18;
  if (ema9 < ema20) sellScore += 18;

  if (bullishCrossNow) {
    buyScore += 40;
    reasons.push("EMA 9 sudah cross ke atas EMA 20. Ini baru valid untuk CALL BUY.");
  }

  if (bearishCrossNow) {
    sellScore += 40;
    reasons.push("EMA 9 sudah cross ke bawah EMA 20. Ini baru valid untuk CALL SELL.");
  }

  if (readyBuy) {
    buyScore += 22;
    reasons.push("EMA 9 mendekati EMA 20 dari bawah. Siap-siap BUY, tapi belum entry sebelum cross.");
  }

  if (readySell) {
    sellScore += 22;
    reasons.push("EMA 9 mendekati EMA 20 dari atas. Siap-siap SELL, tapi belum entry sebelum cross.");
  }

  if (rsi14 >= 50 && rsi14 <= 72) buyScore += 12;
  if (rsi14 <= 50 && rsi14 >= 28) sellScore += 12;

  if (smc?.lastBos?.type === "BULLISH_BOS") buyScore += 12;
  if (smc?.lastBos?.type === "BEARISH_BOS") sellScore += 12;

  if (bullOb?.status === "active" || bullOb?.status === "mitigated") buyScore += Math.min(12, (bullOb.strength || 0) / 9);
  if (bearOb?.status === "active" || bearOb?.status === "mitigated") sellScore += Math.min(12, (bearOb.strength || 0) / 9);

  let finalSignal = "WAIT";
  let callStage = "WAIT";
  let signalLabel = "WAIT";
  const score = Math.max(buyScore, sellScore);

  if (readyBuy && buyScore >= sellScore) {
    finalSignal = "READY_BUY";
    callStage = "READY";
    signalLabel = "SIAP-SIAP BUY";
  }

  if (readySell && sellScore >= buyScore) {
    finalSignal = "READY_SELL";
    callStage = "READY";
    signalLabel = "SIAP-SIAP SELL";
  }

  if (bullishCrossNow && buyScore >= 55 && buyScore > sellScore + 6) {
    finalSignal = "BUY";
    callStage = "CALL";
    signalLabel = "BUY";
  }

  if (bearishCrossNow && sellScore >= 55 && sellScore > buyScore + 6) {
    finalSignal = "SELL";
    callStage = "CALL";
    signalLabel = "SELL";
  }

  let sl = 0;
  let tp = 0;

  if (finalSignal === "BUY") {
    sl = bullOb ? Math.min(bullOb.low, close - atr14 * 1.1) : close - atr14 * 1.4;
    tp = close + Math.abs(close - sl) * 1.7;
  } else if (finalSignal === "SELL") {
    sl = bearOb ? Math.max(bearOb.high, close + atr14 * 1.1) : close + atr14 * 1.4;
    tp = close - Math.abs(sl - close) * 1.7;
  }

  const confidence = callStage === "READY"
    ? Math.min(80, Math.max(55, Math.round(score)))
    : callStage === "CALL"
      ? Math.min(94, Math.max(62, Math.round(score)))
      : Math.min(60, Math.max(45, Math.round(score)));

  const trendBias = ema9 > ema20 ? "Bullish" : ema9 < ema20 ? "Bearish" : "Netral";
  const obTf = "M15";

  if (!reasons.length) {
    reasons.push("Belum ada EMA cross valid. Sistem menunggu EMA 9 mendekati atau crossing EMA 20.");
  }

  if (m15.length < 50) {
    reasons.push("OB M15 belum aktif karena data M15 belum cukup. Pastikan EA terbaru sudah dipasang.");
  }

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    signalLabel,
    callStage,
    entry: round(close),
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
      emaGap: round(gap),
      emaGapThreshold: round(gapThreshold),
      emaGapClosing: gapClosing,
      emaCross,
      crossAlert: {
        status: callStage,
        message: buildCrossMessage(finalSignal, emaCross),
        readyBuy,
        readySell,
        bullishCrossNow,
        bearishCrossNow
      },
      obTimeframe: obTf,
      smc,
      orderBlock: { bullish: bullOb, bearish: bearOb },
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score)
    }
  };
}

function emptyStrategy() {
  return {
    trendBias: "Netral",
    rsi: null,
    rsiMethod: "Wilder RSI 14 seperti MT5 iRSI",
    ema9: null,
    ema20: null,
    emaGap: null,
    emaGapThreshold: null,
    emaGapClosing: false,
    emaCross: "WAIT",
    crossAlert: {
      status: "WAITING_DATA",
      message: "Menunggu data candle.",
      readyBuy: false,
      readySell: false,
      bullishCrossNow: false,
      bearishCrossNow: false
    },
    obTimeframe: "M15",
    smc: null,
    orderBlock: { bullish: null, bearish: null },
    buyScore: 0,
    sellScore: 0,
    score: 0
  };
}

function buildCrossMessage(signal, emaCross) {
  if (signal === "BUY") return "EMA sudah cross bullish. CALL BUY aktif.";
  if (signal === "SELL") return "EMA sudah cross bearish. CALL SELL aktif.";
  if (signal === "READY_BUY") return "EMA mendekati bullish cross. Siap-siap BUY, tunggu cross.";
  if (signal === "READY_SELL") return "EMA mendekati bearish cross. Siap-siap SELL, tunggu cross.";
  return `Belum ada call. Status EMA: ${emaCross}`;
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
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));
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

  return {
    version: "SMC_OB_V2_M15",
    timeframe: "M15",
    swingLookback: 2,
    bosCount: bosEvents.length,
    lastBos: bosEvents[bosEvents.length - 1] || null,
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
    for (const s of swings.filter((x) => x.index === i)) {
      if (s.type === "swingHigh") lastHigh = s;
      if (s.type === "swingLow") lastLow = s;
    }

    const c = data[i];

    if (lastHigh && i > lastHigh.index + 1 && c.close > lastHigh.price + atr14 * 0.05) {
      events.push({ type: "BULLISH_BOS", index: i, time: c.time, breakPrice: round(lastHigh.price), close: round(c.close), brokenSwingTime: lastHigh.time });
      lastHigh = null;
    }

    if (lastLow && i > lastLow.index + 1 && c.close < lastLow.price - atr14 * 0.05) {
      events.push({ type: "BEARISH_BOS", index: i, time: c.time, breakPrice: round(lastLow.price), close: round(c.close), brokenSwingTime: lastLow.time });
      lastLow = null;
    }
  }
  return events;
}

function findOriginCandle(data, bosIndex, direction) {
  const start = Math.max(0, bosIndex - 12);
  const end = bosIndex - 1;
  for (let i = end; i >= start; i--) {
    const c = data[i];
    const body = Math.abs(c.close - c.open);
    const range = Math.max(0.01, c.high - c.low);
    const bodyRatio = body / range;
    if (direction === "bullish" && c.close < c.open) return { ...c, bodyRatio: round(bodyRatio), originIndex: i };
    if (direction === "bearish" && c.close > c.open) return { ...c, bodyRatio: round(bodyRatio), originIndex: i };
  }
  return null;
}

function buildObZone(data, bos, origin, direction, atr14) {
  const displacement = Math.abs(data[bos.index].close - origin.close);
  const displacementAtr = displacement / Math.max(0.01, atr14);
  const strength = Math.min(95, Math.max(45, 45 + displacementAtr * 14 + origin.bodyRatio * 20));

  return {
    type: direction === "bullish" ? "Bullish OB M15" : "Bearish OB M15",
    direction,
    timeframe: "M15",
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
    reason: `${bos.type} M15 setelah origin candle ${direction === "bullish" ? "bearish" : "bullish"}`
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

  return { ...ob, status, mitigated, invalidated, mitigatedTime, invalidatedTime };
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
    trs.push(Math.max(current.high - current.low, Math.abs(current.high - prev.close), Math.abs(current.low - prev.close)));
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
