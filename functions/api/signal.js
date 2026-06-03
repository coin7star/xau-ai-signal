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
  const candlesM15 = []; // Step 10AQ: Strategy utama fokus M5, M15/OB tidak dipakai di dashboard.
  const signal = buildSignal(candles, candlesM15, market);

  const telegram = await maybeSendTelegramAlert(env, dbUrl, signal, market);
  const callHistory = await maybeSaveCallHistory(env, dbUrl, signal, market);
  const scalpHistory = { ok: false, skipped: "disabled-focus-main-strategy-only" };
  const strategyBHistory = { ok: false, skipped: "disabled-focus-main-strategy-only" };

  return json({
    ...signal,
    telegram,
    callHistory,
    scalpHistory,
    strategyBHistory
  });
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
      signalLabel: "WAIT",
      callStage: "WAITING_DATA",
      candleTime: last?.time || null,
      entry: round(market?.bid || 0),
      sl: 0,
      tp: 0,
      confidence: 50,
      reason: "Menunggu minimal 50 candle M1. Strategi butuh RSI + MFI + EMA 9/20 + OB M15.",
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
  const mfi14 = mfi(m1, 14);
  const atr14 = atr(m1, 14);
  const close = last.close;

  const smc = null;
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

  const rsiBuyOk = rsi14 >= 50 && rsi14 <= 72;
  const rsiSellOk = rsi14 <= 50 && rsi14 >= 28;
  const mfiBuyOk = mfi14 >= 50 && mfi14 <= 80;
  const mfiSellOk = mfi14 <= 50 && mfi14 >= 20;

  const nearBullOB = bullOb && bullOb.status !== "invalid" && close >= bullOb.low - atr14 * 0.45 && close <= bullOb.high + atr14 * 1.0;
  const nearBearOB = bearOb && bearOb.status !== "invalid" && close <= bearOb.high + atr14 * 0.45 && close >= bearOb.low - atr14 * 1.0;

  const obBuyOk = Boolean(nearBullOB);
  const obSellOk = Boolean(nearBearOB);

  let emaCross = "NEUTRAL";
  if (bullishCrossNow) emaCross = "BULLISH_CROSS";
  else if (bearishCrossNow) emaCross = "BEARISH_CROSS";
  else if (readyBuy) emaCross = "READY_BULLISH_CROSS";
  else if (readySell) emaCross = "READY_BEARISH_CROSS";
  else if (ema9 > ema20) emaCross = "BULLISH_TREND";
  else if (ema9 < ema20) emaCross = "BEARISH_TREND";

  const mainM5 = buildMainM5EmaPullbackLimitSignal(market, m1);

  let buyScore = mainM5.direction === "BUY" ? mainM5.score : 0;
  let sellScore = mainM5.direction === "SELL" ? mainM5.score : 0;
  const reasons = [mainM5.reason].filter(Boolean);

  let finalSignal = "WAIT";
  let callStage = "WAIT";
  let signalLabel = "WAIT";

  const buyAllMatch = mainM5.action === "BUY_LIMIT";
  const sellAllMatch = mainM5.action === "SELL_LIMIT";
  const readyBuyAllMatch = mainM5.action === "READY_BUY";
  const readySellAllMatch = mainM5.action === "READY_SELL";

  if (readyBuyAllMatch) {
    finalSignal = "READY_BUY";
    callStage = "READY";
    signalLabel = "SIAP BUY LIMIT";
  } else if (readySellAllMatch) {
    finalSignal = "READY_SELL";
    callStage = "READY";
    signalLabel = "SIAP SELL LIMIT";
  }

  if (buyAllMatch) {
    finalSignal = "BUY";
    callStage = "CALL";
    signalLabel = "BUY LIMIT";
  } else if (sellAllMatch) {
    finalSignal = "SELL";
    callStage = "CALL";
    signalLabel = "SELL LIMIT";
  }

  if (finalSignal === "WAIT") {
    reasons.push(mainM5.blocker || "Menunggu EMA 9/20 M5 valid lalu engulfing close di area EMA 9/20.");
  }

  const score = Math.max(buyScore, sellScore);
  let sl = Number(mainM5.sl || 0);
  let tp = Number(mainM5.tp || 0);
  const mainEntry = Number(mainM5.entry || close || 0);

  const confidence = callStage === "READY"
    ? Math.min(82, Math.max(58, Math.round(mainM5.confidence || score)))
    : callStage === "CALL"
      ? Math.min(95, Math.max(68, Math.round(mainM5.confidence || score)))
      : Math.min(60, Math.max(45, Math.round(mainM5.confidence || score)));

  const finalQualityGuard = buildSignalQualityGuardV2({
    market,
    m1,
    m15,
    close,
    atr14,
    confidence,
    buyAllMatch,
    sellAllMatch,
    readyBuyAllMatch,
    readySellAllMatch,
    rsiBuyOk,
    rsiSellOk,
    mfiBuyOk,
    mfiSellOk,
    obBuyOk,
    obSellOk,
    bullishCrossNow,
    bearishCrossNow,
    readyBuy,
    readySell,
    m15Ready: m15.length >= 50,
    mainM5
  });

  if (callStage === "CALL" && !finalQualityGuard.allowCall) {
    finalSignal = "WAIT";
    callStage = "WAIT";
    signalLabel = "WAIT";
    reasons.push(`Signal Quality Guard menahan CALL: ${finalQualityGuard.blockers[0] || "market belum ideal"}.`);
  }

  const trendBias = ema9 > ema20 ? "Bullish" : ema9 < ema20 ? "Bearish" : "Netral";
  const scalping = {
    mode: "DISABLED_FOCUS_MAIN_STRATEGY",
    action: "DISABLED",
    label: "Nonaktif",
    confidence: 0,
    entry: 0,
    sl: 0,
    tp: 0,
    reason: "Mode scalp disembunyikan agar dashboard fokus ke Sinyal Utama M5."
  };

  const strategyB = {
    name: "SMC AI",
    mode: "DISABLED_FOCUS_MAIN_STRATEGY",
    action: "DISABLED",
    label: "Nonaktif",
    direction: "WAIT",
    confidence: 0,
    entry: 0,
    sl: 0,
    tp: 0,
    reason: "SMC AI disembunyikan agar dashboard fokus ke Sinyal Utama M5."
  };

  const humanReason = buildMainM5LimitHumanReason({
    mainM5,
    finalSignal,
    signalLabel,
    callStage,
    confidence,
    qualityGuard: finalQualityGuard,
    rsi14,
    mfi14,
    ema9,
    ema20,
    legacyReasons: reasons
  });

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    signalLabel,
    callStage,
    candleTime: last.time || null,
    entry: round(mainEntry),
    sl: round(sl),
    tp: round(tp),
    tp1: round(mainM5.tp1 || 0),
    tp2: round(mainM5.tp2 || tp || 0),
    confidence,
    reason: humanReason.summary,
    reasonDetails: humanReason,
    qualityGuard: finalQualityGuard,
    strategyB,
    mode: "firebase-mt5-data",
    strategy: {
      trendBias,
      mainMode: "M5_EMA_PULLBACK_LIMIT",
      mainM5,
      rsi: round(rsi14),
      rsiMethod: "Wilder RSI 14 seperti MT5 iRSI",
      mfi: round(mfi14),
      mfiMethod: "Money Flow Index 14 dari candle volume MT5",
      ema9: round(ema9),
      ema20: round(ema20),
      emaGap: round(gap),
      emaGapThreshold: round(gapThreshold),
      emaGapClosing: gapClosing,
      emaCross,
      confirmation: {
        buyAllMatch,
        sellAllMatch,
        readyBuyAllMatch,
        readySellAllMatch,
        rsiBuyOk,
        rsiSellOk,
        mfiBuyOk,
        mfiSellOk,
        obBuyOk,
        obSellOk
      },
      crossAlert: {
        status: callStage,
        message: buildCrossMessage(finalSignal, emaCross),
        readyBuy,
        readySell,
        bullishCrossNow,
        bearishCrossNow
      },
      obTimeframe: "M5_ONLY",
      smc,
      orderBlock: { bullish: bullOb, bearish: bearOb },
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score),
      scalping,
      strategyB,
      qualityGuard: finalQualityGuard,
      probability: buildProbability(signalLabel, callStage, buyScore, sellScore, {
        rsiBuyOk,
        rsiSellOk,
        mfiBuyOk,
        mfiSellOk,
        obBuyOk,
        obSellOk,
        bullishCrossNow,
        bearishCrossNow,
        readyBuy,
        readySell
      })
    }
  };
}







function buildMainM5EmaPullbackLimitSignal(market = {}, m1Candles = []) {
  const m5 = getMainM5Candles(market, m1Candles);
  const last = m5[m5.length - 1];
  if (!last || m5.length < 20) {
    return {
      mode: "M5_EMA_STRUCTURE_DYNAMIC_LIMIT_MAIN",
      action: "WAIT",
      label: "Main Signal WAIT",
      direction: "WAIT",
      score: 0,
      confidence: 45,
      entry: 0,
      sl: 0,
      tp: 0,
      tp1: 0,
      tp2: 0,
      rr: "partial",
      dataReady: false,
      sourceTimeframe: Array.isArray(market?.candlesM5) ? "MT5_VPS_M5" : "M1_AGGREGATED_TO_M5",
      reason: "Menunggu data candle M5 cukup untuk membaca struktur, EMA 9/20, dan area limit.",
      blocker: "Data candle M5 belum cukup."
    };
  }

  const closes = m5.map((c) => Number(c.close));
  const ema9Series = emaSeries(closes, 9);
  const ema20Series = emaSeries(closes, 20);
  const ema9Now = Number(ema9Series[ema9Series.length - 1] || 0);
  const ema20Now = Number(ema20Series[ema20Series.length - 1] || 0);
  const prevEma9 = Number(ema9Series[ema9Series.length - 2] || ema9Now);
  const prevEma20 = Number(ema20Series[ema20Series.length - 2] || ema20Now);
  const atrValue = Number(atr(m5, 14) || Math.max(Math.abs(Number(last.high) - Number(last.low)), 1));
  const buffer = Math.max(atrValue * 0.25, Number(last.close) * 0.00008);

  const structure = getM5EmaStructureBreak(m5);
  const prevCandle = m5[m5.length - 2] || null;
  const bullishEngulfing = Boolean(prevCandle && isBullishEngulfing(prevCandle, last));
  const bearishEngulfing = Boolean(prevCandle && isBearishEngulfing(prevCandle, last));
  const emaBuyBias = ema9Now > ema20Now;
  const emaSellBias = ema9Now < ema20Now;
  const emaUp = emaBuyBias && ema9Now >= prevEma9 && ema20Now >= prevEma20 * 0.9997;
  const emaDown = emaSellBias && ema9Now <= prevEma9 && ema20Now <= prevEma20 * 1.0003;
  const focusDirection = emaBuyBias ? "BUY_ONLY" : emaSellBias ? "SELL_ONLY" : "WAIT";
  const touchedEmaZone = Number(last.low) <= Math.max(ema9Now, ema20Now) + buffer && Number(last.high) >= Math.min(ema9Now, ema20Now) - buffer;
  const closeHoldsBuy = Number(last.close) >= Math.min(ema9Now, ema20Now) - buffer;
  const closeHoldsSell = Number(last.close) <= Math.max(ema9Now, ema20Now) + buffer;
  const buyEngulfAtEma = bullishEngulfing && touchedEmaZone && closeHoldsBuy && emaBuyBias;
  const sellEngulfAtEma = bearishEngulfing && touchedEmaZone && closeHoldsSell && emaSellBias;
  const engulfingWave = countM5EngulfingsInCurrentEmaWave(m5, ema9Series, ema20Series, focusDirection, atrValue);
  const buyEngulfSlotOk = focusDirection !== "BUY_ONLY" || engulfingWave.count <= 2;
  const sellEngulfSlotOk = focusDirection !== "SELL_ONLY" || engulfingWave.count <= 2;

  const buyStructureValid = structure.breakHigh && emaBuyBias;
  const sellStructureValid = structure.breakLow && emaSellBias;
  const buyReady = focusDirection === "BUY_ONLY" && buyStructureValid && emaUp && !buyEngulfAtEma && buyEngulfSlotOk;
  const sellReady = focusDirection === "SELL_ONLY" && sellStructureValid && emaDown && !sellEngulfAtEma && sellEngulfSlotOk;
  const buyValid = focusDirection === "BUY_ONLY" && buyStructureValid && emaUp && buyEngulfAtEma && buyEngulfSlotOk;
  const sellValid = focusDirection === "SELL_ONLY" && sellStructureValid && emaDown && sellEngulfAtEma && sellEngulfSlotOk;

  let action = "WAIT";
  let direction = "WAIT";
  let label = "Main Signal WAIT";
  let entry = 0;
  let sl = 0;
  let tp = 0;
  let tp1 = 0;
  let tp2 = 0;
  let score = 0;
  let blocker = focusDirection === "BUY_ONLY"
    ? "Mode fokus BUY: EMA9 di atas EMA20. Menunggu struktur bullish dan bullish engulfing di area EMA."
    : focusDirection === "SELL_ONLY"
      ? "Mode fokus SELL: EMA9 di bawah EMA20. Menunggu struktur bearish dan bearish engulfing di area EMA."
      : "Menunggu EMA9/EMA20 menentukan arah trend.";

  if ((focusDirection === "BUY_ONLY" && !buyEngulfSlotOk) || (focusDirection === "SELL_ONLY" && !sellEngulfSlotOk)) {
    blocker = "Maksimal 2 engulfing valid untuk EMA cross/trend saat ini sudah terpenuhi. Menunggu EMA cross baru.";
  }

  const previewDirection = (buyEngulfAtEma && buyEngulfSlotOk) ? "BUY" : (sellEngulfAtEma && sellEngulfSlotOk) ? "SELL" : "WAIT";
  const previewEntry = ((buyEngulfAtEma && buyEngulfSlotOk) || (sellEngulfAtEma && sellEngulfSlotOk)) ? Number(last.open) : 0;
  const previewLabel = previewDirection === "BUY"
    ? "Preview BUY limit · open engulfing"
    : previewDirection === "SELL"
      ? "Preview SELL limit · open engulfing"
      : "Menunggu engulfing di area EMA";

  if (buyReady) {
    action = "READY_BUY";
    direction = "BUY";
    label = "Main Signal siap BUY LIMIT";
    entry = 0;
    tp = 0;
    tp1 = 0;
    tp2 = 0;
    sl = 0;
    score = 64;
    blocker = "Struktur M5 sudah break swing high dan EMA naik. Menunggu bullish engulfing di area EMA 9/20. Preview limit akan memakai open candle engulfing.";
  } else if (sellReady) {
    action = "READY_SELL";
    direction = "SELL";
    label = "Main Signal siap SELL LIMIT";
    entry = 0;
    tp = 0;
    tp1 = 0;
    tp2 = 0;
    sl = 0;
    score = 64;
    blocker = "Struktur M5 sudah break swing low dan EMA turun. Menunggu bearish engulfing di area EMA 9/20. Preview limit akan memakai open candle engulfing.";
  }

  if (buyValid) {
    action = "BUY_LIMIT";
    direction = "BUY";
    label = "Main Signal BUY LIMIT";
    entry = Number(last.open);
    sl = Number(last.low) - atrValue * 0.5;
    const risk = Math.abs(entry - sl);
    tp1 = entry + (risk * 0.5);
    tp2 = entry + risk;
    tp = tp2;
    if (tp2 > tp1 && tp1 > entry && sl < entry) {
      score = 88;
      blocker = "";
    } else {
      action = "WAIT";
      direction = "WAIT";
      label = "Main Signal WAIT";
      blocker = "Risk BUY belum valid dari open engulfing ke SL.";
      score = 55;
    }
  } else if (sellValid) {
    action = "SELL_LIMIT";
    direction = "SELL";
    label = "Main Signal SELL LIMIT";
    entry = Number(last.open);
    sl = Number(last.high) + atrValue * 0.5;
    const risk = Math.abs(sl - entry);
    tp1 = entry - (risk * 0.5);
    tp2 = entry - risk;
    tp = tp2;
    if (tp2 < tp1 && tp1 < entry && sl > entry) {
      score = 88;
      blocker = "";
    } else {
      action = "WAIT";
      direction = "WAIT";
      label = "Main Signal WAIT";
      blocker = "Risk SELL belum valid dari open engulfing ke SL.";
      score = 55;
    }
  }

  if ((buyEngulfAtEma && !buyEngulfSlotOk) || (sellEngulfAtEma && !sellEngulfSlotOk)) {
    action = "WAIT";
    direction = "WAIT";
    label = "Main Signal WAIT";
    entry = 0;
    sl = 0;
    tp = 0;
    tp1 = 0;
    tp2 = 0;
    score = Math.max(45, score);
    blocker = "Engulfing di area EMA terdeteksi, tapi kuota 2 engulfing untuk EMA cross saat ini sudah habis.";
  }

  const confidence = action.includes("LIMIT") ? 88 : action.includes("READY") ? 66 : Math.max(45, score);
  const cross = { type: buyStructureValid ? "STRUCTURE_BULLISH" : sellStructureValid ? "STRUCTURE_BEARISH" : "NONE", index: structure.breakIndex, time: structure.breakTime };
  const reason = buildMainM5LimitReason({ action, direction, entry, sl, tp, cross, touchedEma9: touchedEmaZone, ema9Now, ema20Now, structure, blocker });

  return {
    mode: "M5_EMA_STRUCTURE_DYNAMIC_LIMIT_MAIN",
    action,
    label,
    direction,
    score,
    confidence,
    entry: round(entry),
    sl: round(sl),
    tp: round(tp),
    tp1: round(tp1),
    tp2: round(tp2 || tp),
    rr: "TP1 1:1 → BE · TP2 max",
    dataReady: true,
    timeframe: "M5",
    sourceTimeframe: Array.isArray(market?.candlesM5) ? "MT5_VPS_M5" : "M1_AGGREGATED_TO_M5",
    ema9: round(ema9Now),
    ema20: round(ema20Now),
    emaDirectionLock: focusDirection,
    focusDirection,
    engulfingWave,
    maxEngulfingPerEmaCross: 2,
    atr: round(atrValue),
    cross,
    bosKey: structure.bosKey || null,
    bosDirection: structure.breakHigh ? "BULLISH_BOS" : structure.breakLow ? "BEARISH_BOS" : "NONE",
    correction: { touchedEma9: touchedEmaZone, touchedEmaZone, buffer: round(buffer), candleTime: last.time || null },
    engulfing: {
      required: true,
      bullish: bullishEngulfing,
      bearish: bearishEngulfing,
      validAtEma: direction === "BUY" ? buyEngulfAtEma : direction === "SELL" ? sellEngulfAtEma : Boolean(buyEngulfAtEma || sellEngulfAtEma),
      note: "Entry limit hanya valid jika candle engulfing M5 muncul di area EMA 9/20."
    },
    preview: {
      active: previewEntry > 0 && Boolean(buyEngulfAtEma || sellEngulfAtEma),
      direction: previewDirection,
      entry: round(previewEntry),
      label: previewLabel,
      note: "Garis preview hanya muncul setelah candle engulfing M5 close valid di area EMA 9/20, dan posisinya memakai open candle engulfing."
    },
    structure,
    entryMethod: "LIMIT_AT_OPEN_OF_M5_ENGULFING_THAT_TOUCHES_EMA_9_20",
    tpMethod: direction === "BUY" ? "TP1_HALF_RISK_THEN_TP2_RR_1_1" : direction === "SELL" ? "TP1_HALF_RISK_THEN_TP2_RR_1_1" : "WAIT",
    slMethod: direction === "BUY" ? "BELOW_EMA_TOUCH_M5_CANDLE_LOW_PLUS_0_5_ATR" : direction === "SELL" ? "ABOVE_EMA_TOUCH_M5_CANDLE_HIGH_PLUS_0_5_ATR" : "WAIT",
    partialTp: {
      enabled: true,
      tp1: round(tp1),
      tp2: round(tp2 || tp),
      tp1Note: "TP1 = setengah jarak menuju TP Max. Setelah TP1, posisi disarankan jadi BE.",
      tp2Note: "TP Max = RR 1:1 dari jarak Entry ke SL.",
      afterTp1: "MOVE_SL_TO_BE"
    },
    emaTouchCandle: {
      time: last.time || null,
      open: round(last.open),
      high: round(last.high),
      low: round(last.low),
      close: round(last.close)
    },
    maxPending: 4,
    maxBuyPending: 2,
    maxSellPending: 2,
    replaceOldOnNewStructure: true,
    reason,
    blocker,
    checklist: [
      { name: "Struktur M5 break", status: buyStructureValid || sellStructureValid ? "PASS" : "WAIT" },
      { name: "Mode fokus EMA", status: focusDirection !== "WAIT" ? focusDirection : "WAIT" },
      { name: "EMA 9/20 searah", status: (focusDirection === "BUY_ONLY" && emaUp) || (focusDirection === "SELL_ONLY" && emaDown) ? "PASS" : "WAIT" },
      { name: "Candle sentuh EMA", status: touchedEmaZone ? "PASS" : "WAIT" },
      { name: "Engulfing M5 area EMA", status: buyEngulfAtEma || sellEngulfAtEma ? "PASS" : "WAIT" },
      { name: "Max 2 engulfing/cross", status: engulfingWave.count <= 2 ? `${engulfingWave.count}/2` : "FULL" },
      { name: "Entry limit open engulf", status: entry > 0 ? "PASS" : "WAIT" },
      { name: "TP parsial", status: tp1 > 0 && tp2 > 0 ? "PASS" : "WAIT" },
      { name: "SL candle sentuh EMA", status: sl > 0 ? "PASS" : "WAIT" }
    ]
  };
}

function getM5EmaStructureBreak(candles = []) {
  const valid = candles
    .map((c, idx) => ({ ...c, _idx: idx, high: Number(c.high), low: Number(c.low), open: Number(c.open), close: Number(c.close) }))
    .filter((c) => [c.high, c.low, c.open, c.close].every(Number.isFinite));
  const lastIndex = valid.length - 1;
  const lookback = valid.slice(Math.max(0, valid.length - 22), Math.max(0, valid.length - 1));
  const previous = lookback.length ? lookback : valid.slice(Math.max(0, valid.length - 14), Math.max(0, valid.length - 1));
  const prevHighCandle = previous.length ? previous.reduce((best, c) => c.high > best.high ? c : best, previous[0]) : null;
  const prevLowCandle = previous.length ? previous.reduce((best, c) => c.low < best.low ? c : best, previous[0]) : null;
  const last = valid[lastIndex] || null;
  const breakHigh = Boolean(last && prevHighCandle && (last.close > prevHighCandle.high || last.high > prevHighCandle.high));
  const breakLow = Boolean(last && prevLowCandle && (last.close < prevLowCandle.low || last.low < prevLowCandle.low));
  const bosType = breakHigh ? "BULLISH_BOS" : breakLow ? "BEARISH_BOS" : "NO_BOS";
  const bosKey = [
    bosType,
    last?.time || last?._idx || "na",
    round(prevHighCandle?.high || 0),
    round(prevLowCandle?.low || 0)
  ].join("_").replaceAll(" ", "_").replaceAll(":", "-").replaceAll(".", "-").replaceAll("/", "-");
  return {
    breakHigh,
    breakLow,
    bosType,
    bosKey,
    breakIndex: last?._idx ?? -1,
    breakTime: last?.time || null,
    previousSwingHigh: round(prevHighCandle?.high || 0),
    previousSwingLow: round(prevLowCandle?.low || 0),
    targetHighBody: round(prevHighCandle ? Math.max(prevHighCandle.open, prevHighCandle.close) : 0),
    targetLowBody: round(prevLowCandle ? Math.min(prevLowCandle.open, prevLowCandle.close) : 0),
    method: "M5_BREAK_PREVIOUS_SWING_THEN_DYNAMIC_EMA_LIMIT"
  };
}

function countM5EngulfingsInCurrentEmaWave(candles = [], ema9Values = [], ema20Values = [], focusDirection = "WAIT", atrValue = 0) {
  const valid = candles
    .map((c, idx) => ({ ...c, _idx: idx, high: Number(c.high), low: Number(c.low), open: Number(c.open), close: Number(c.close), time: c.time || null }))
    .filter((c) => [c.high, c.low, c.open, c.close].every(Number.isFinite));

  if (valid.length < 2 || !Array.isArray(ema9Values) || !Array.isArray(ema20Values)) {
    return { direction: focusDirection, count: 0, max: 2, crossIndex: -1, crossTime: null, isFull: false, items: [] };
  }

  const direction = focusDirection === "BUY_ONLY" ? "BUY" : focusDirection === "SELL_ONLY" ? "SELL" : "WAIT";
  if (direction === "WAIT") return { direction, count: 0, max: 2, crossIndex: -1, crossTime: null, isFull: false, items: [] };

  let crossIndex = 1;
  for (let i = Math.min(valid.length - 1, ema9Values.length - 1, ema20Values.length - 1); i >= 1; i--) {
    const p9 = Number(ema9Values[i - 1]);
    const p20 = Number(ema20Values[i - 1]);
    const e9 = Number(ema9Values[i]);
    const e20 = Number(ema20Values[i]);
    if (direction === "BUY" && p9 <= p20 && e9 > e20) { crossIndex = i; break; }
    if (direction === "SELL" && p9 >= p20 && e9 < e20) { crossIndex = i; break; }
  }

  const items = [];
  for (let i = Math.max(1, crossIndex); i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];
    const ema9 = Number(ema9Values[i] || 0);
    const ema20 = Number(ema20Values[i] || 0);
    const localAtr = Number(atrValue || Math.max(Math.abs(curr.high - curr.low), 1));
    const buffer = Math.max(localAtr * 0.25, Number(curr.close) * 0.00008);
    const touchedEmaZone = curr.low <= Math.max(ema9, ema20) + buffer && curr.high >= Math.min(ema9, ema20) - buffer;
    const closeHoldsBuy = curr.close >= Math.min(ema9, ema20) - buffer;
    const closeHoldsSell = curr.close <= Math.max(ema9, ema20) + buffer;
    const bullish = direction === "BUY" && isBullishEngulfing(prev, curr) && touchedEmaZone && closeHoldsBuy && ema9 > ema20;
    const bearish = direction === "SELL" && isBearishEngulfing(prev, curr) && touchedEmaZone && closeHoldsSell && ema9 < ema20;
    if (bullish || bearish) {
      items.push({ index: i, time: curr.time || null, open: round(curr.open), type: bullish ? "BULLISH_ENGULFING" : "BEARISH_ENGULFING" });
    }
  }

  return {
    direction,
    count: items.length,
    max: 2,
    remaining: Math.max(0, 2 - items.length),
    crossIndex,
    crossTime: valid[crossIndex]?.time || null,
    isFull: items.length >= 2,
    items: items.slice(-2)
  };
}

function getMainM5Candles(market = {}, m1Candles = []) {
  const native = Array.isArray(market?.candlesM5) ? clean(market.candlesM5) : [];
  if (native.length >= 20) return native.slice(-180);
  return aggregateCandlesToM5(m1Candles);
}

function getPreferredM5Candles(market = {}, m1Candles = []) {
  const native = Array.isArray(market?.candlesM5) ? clean(market.candlesM5) : [];
  if (native.length >= 20) return native.slice(-180);
  return aggregateCandlesToM5(m1Candles);
}

function emaSeries(values = [], period = 9) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = nums[0];
  for (let i = 0; i < nums.length; i++) {
    prev = i === 0 ? nums[i] : nums[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function findRecentM5EmaCross(candles = [], ema9Values = [], ema20Values = [], lookback = 18) {
  const start = Math.max(1, ema9Values.length - lookback);
  for (let i = ema9Values.length - 1; i >= start; i--) {
    const p9 = Number(ema9Values[i - 1]);
    const p20 = Number(ema20Values[i - 1]);
    const e9 = Number(ema9Values[i]);
    const e20 = Number(ema20Values[i]);
    if (p9 <= p20 && e9 > e20) return { type: "BULLISH", index: i, time: candles[i]?.time || null };
    if (p9 >= p20 && e9 < e20) return { type: "BEARISH", index: i, time: candles[i]?.time || null };
  }
  return { type: "NONE", index: -1, time: null };
}

function getM5PullbackStructure(candles = [], crossIndex = -1) {
  const end = candles.length;
  const start = crossIndex >= 0 ? Math.max(0, crossIndex) : Math.max(0, end - 18);
  const segment = candles.slice(start, end);
  const fallback = candles.slice(-14);
  const use = segment.length >= 4 ? segment : fallback;
  const valid = use
    .map((c, idx) => ({ ...c, _idx: idx, high: Number(c.high), low: Number(c.low), open: Number(c.open), close: Number(c.close) }))
    .filter((c) => [c.high, c.low, c.open, c.close].every(Number.isFinite));
  const highCandle = valid.length ? valid.reduce((best, c) => c.high > best.high ? c : best, valid[0]) : null;
  const lowCandle = valid.length ? valid.reduce((best, c) => c.low < best.low ? c : best, valid[0]) : null;
  const swingHighWick = highCandle ? highCandle.high : 0;
  const swingLowWick = lowCandle ? lowCandle.low : 0;
  const swingHighBody = highCandle ? Math.max(highCandle.open, highCandle.close) : 0;
  const swingLowBody = lowCandle ? Math.min(lowCandle.open, lowCandle.close) : 0;
  return {
    swingHigh: round(swingHighWick),
    swingLow: round(swingLowWick),
    swingHighBody: round(swingHighBody),
    swingLowBody: round(swingLowBody),
    tpSource: "BODY_OPEN_CLOSE_SWING",
    method: "M5_AFTER_EMA_BREAK_STRUCTURE_BODY_TP",
    fromIndex: start,
    candleCount: use.length
  };
}

function buildMainM5LimitReason(data = {}) {
  const { action, direction, entry, sl, tp, cross, touchedEma9, blocker } = data;
  if (action === "BUY_LIMIT") {
    return `Main Signal BUY LIMIT valid. Struktur M5 bullish, EMA 9/20 searah, dan bullish engulfing muncul di area EMA. Entry limit di open engulfing ${round(entry)}, TP1 setengah jalan untuk BE, TP Max RR 1:1, SL di bawah low engulfing + 0.5 ATR.`;
  }
  if (action === "SELL_LIMIT") {
    return `Main Signal SELL LIMIT valid. Struktur M5 bearish, EMA 9/20 searah, dan bearish engulfing muncul di area EMA. Entry limit di open engulfing ${round(entry)}, TP1 setengah jalan untuk BE, TP Max RR 1:1, SL di atas high engulfing + 0.5 ATR.`;
  }
  if (action === "READY_BUY") return blocker || "EMA bullish sudah aktif. Menunggu bullish engulfing M5 di area EMA untuk BUY LIMIT.";
  if (action === "READY_SELL") return blocker || "EMA bearish sudah aktif. Menunggu bearish engulfing M5 di area EMA untuk SELL LIMIT.";
  if (cross?.type === "NONE") return "Menunggu EMA 9 break EMA 20 di M5.";
  if (!touchedEma9) return blocker || "Menunggu candle engulfing M5 close valid di area EMA 9/20.";
  return blocker || "Menunggu setup M5 EMA pullback limit yang valid.";
}

function buildMainM5LimitHumanReason(ctx = {}) {
  const m = ctx.mainM5 || {};
  const isCall = ctx.callStage === "CALL";
  const isReady = ctx.callStage === "READY";
  const title = isCall ? `${ctx.signalLabel} aktif.` : isReady ? `${ctx.signalLabel} mulai siap.` : "Belum ada limit utama valid.";
  const summary = [
    title,
    m.reason || "Menunggu EMA 9/20 M5 dan engulfing valid di area EMA.",
    ctx.qualityGuard?.message ? `Safety: ${ctx.qualityGuard.message}` : ""
  ].filter(Boolean).join(" ");
  return {
    version: "10AO-main-m5-ema-pullback-limit",
    title,
    summary,
    action: isCall ? "Pantau limit sesuai entry, SL, dan TP. Jangan entry market kalau harga belum sesuai rencana." : "Tunggu EMA valid dan engulfing close di area EMA 9/20.",
    direction: m.direction || "WAIT",
    checklist: m.checklist || [],
    blockers: m.blocker ? [m.blocker] : [],
    score: { buy: ctx.finalSignal === "BUY" ? ctx.confidence : 0, sell: ctx.finalSignal === "SELL" ? ctx.confidence : 0, confidence: ctx.confidence },
    raw: ctx.legacyReasons || []
  };
}

function buildStrategyBSmcAI(m1 = [], m15 = [], ctx = {}) {
  const close = Number(ctx.close || 0);
  const atr14 = Number(ctx.atr14 || 0);
  const ema9 = Number(ctx.ema9 || 0);
  const ema20 = Number(ctx.ema20 || 0);
  const prevEma9 = Number(ctx.prevEma9 || 0);
  const prevEma20 = Number(ctx.prevEma20 || 0);
  const rsi14 = Number(ctx.rsi14 || 0);
  const mfi14 = Number(ctx.mfi14 || 0);
  const bullOb = normalizeStrategyBOb(ctx.bullOb, "BUY");
  const bearOb = normalizeStrategyBOb(ctx.bearOb, "SELL");

  const bullishObValid = isStrategyBObValid(bullOb, close, atr14, "BUY");
  const bearishObValid = isStrategyBObValid(bearOb, close, atr14, "SELL");
  const inBullOb = bullishObValid && close >= bullOb.low && close <= bullOb.high;
  const inBearOb = bearishObValid && close >= bearOb.low && close <= bearOb.high;

  const sweepLow = detectStrategyBLiquiditySweep(m1, "LOW");
  const sweepHigh = detectStrategyBLiquiditySweep(m1, "HIGH");
  const chochBull = detectStrategyBChoch(m1, "BULLISH");
  const chochBear = detectStrategyBChoch(m1, "BEARISH");
  const emaBullish = (prevEma9 <= prevEma20 && ema9 > ema20) || (ema9 > ema20 && ema9 > prevEma9 && ema20 >= prevEma20 * 0.9995);
  const emaBearish = (prevEma9 >= prevEma20 && ema9 < ema20) || (ema9 < ema20 && ema9 < prevEma9 && ema20 <= prevEma20 * 1.0005);

  const buySteps = {
    freshOb: bullishObValid,
    priceInOb: inBullOb,
    sweep: Boolean(inBullOb && sweepLow.valid),
    choch: Boolean(inBullOb && sweepLow.valid && chochBull.valid),
    ema: Boolean(inBullOb && sweepLow.valid && chochBull.valid && emaBullish)
  };
  const sellSteps = {
    freshOb: bearishObValid,
    priceInOb: inBearOb,
    sweep: Boolean(inBearOb && sweepHigh.valid),
    choch: Boolean(inBearOb && sweepHigh.valid && chochBear.valid),
    ema: Boolean(inBearOb && sweepHigh.valid && chochBear.valid && emaBearish)
  };

  const buyScore = strategyBScore(buySteps, rsi14 > 50, mfi14 > 50);
  const sellScore = strategyBScore(sellSteps, rsi14 < 50, mfi14 < 50);
  const direction = buyScore >= sellScore ? "BUY" : "SELL";
  const activeSteps = direction === "BUY" ? buySteps : sellSteps;
  const activeOb = direction === "BUY" ? bullOb : bearOb;
  const activeSweep = direction === "BUY" ? sweepLow : sweepHigh;
  const activeChoch = direction === "BUY" ? chochBull : chochBear;
  const activeEma = direction === "BUY" ? emaBullish : emaBearish;

  let action = "WAIT";
  let label = "SMC AI WAIT";
  if (buySteps.freshOb && buySteps.priceInOb && buySteps.sweep && buySteps.choch && buySteps.ema) {
    action = "CALL_BUY";
    label = "SMC AI BUY";
  } else if (sellSteps.freshOb && sellSteps.priceInOb && sellSteps.sweep && sellSteps.choch && sellSteps.ema) {
    action = "CALL_SELL";
    label = "SMC AI SELL";
  } else if ((buySteps.freshOb && buySteps.priceInOb && buySteps.sweep) || (sellSteps.freshOb && sellSteps.priceInOb && sellSteps.sweep)) {
    action = direction === "BUY" ? "READY_BUY" : "READY_SELL";
    label = direction === "BUY" ? "SMC AI READY BUY" : "SMC AI READY SELL";
  }

  const entry = close;
  let sl = 0;
  let tp = 0;
  const rr = 2;
  if ((action === "CALL_BUY" || action === "READY_BUY") && sweepLow.price && atr14) {
    sl = sweepLow.price - (1.5 * atr14);
    tp = entry + Math.abs(entry - sl) * rr;
  } else if ((action === "CALL_SELL" || action === "READY_SELL") && sweepHigh.price && atr14) {
    sl = sweepHigh.price + (1.5 * atr14);
    tp = entry - Math.abs(sl - entry) * rr;
  }

  const checklist = [
    { name: "Fresh OB M15", buy: buySteps.freshOb, sell: sellSteps.freshOb },
    { name: "Harga di area OB", buy: buySteps.priceInOb, sell: sellSteps.priceInOb },
    { name: "Liquidity Sweep M1", buy: buySteps.sweep, sell: sellSteps.sweep },
    { name: "CHOCH M1", buy: buySteps.choch, sell: sellSteps.choch },
    { name: "EMA 9/20 M1", buy: buySteps.ema, sell: sellSteps.ema }
  ];

  const blockers = buildStrategyBBlockers(activeSteps, direction);
  const confidence = Math.min(100, Math.max(0, direction === "BUY" ? buyScore : sellScore));

  return {
    id: "strategyB",
    name: "SMC AI",
    mode: "LIVE_BACKTEST_ONLY",
    action,
    label,
    direction,
    confidence,
    entry: round(entry),
    sl: round(sl),
    tp: round(tp),
    rr: "1:2",
    reason: buildStrategyBReason(action, direction, blockers),
    checklist,
    blockers,
    buy: {
      steps: buySteps,
      score: Math.min(100, buyScore),
      ob: bullOb,
      sweep: sweepLow,
      choch: chochBull,
      ema: emaBullish,
      rsiBooster: rsi14 > 50,
      mfiBooster: mfi14 > 50
    },
    sell: {
      steps: sellSteps,
      score: Math.min(100, sellScore),
      ob: bearOb,
      sweep: sweepHigh,
      choch: chochBear,
      ema: emaBearish,
      rsiBooster: rsi14 < 50,
      mfiBooster: mfi14 < 50
    },
    active: {
      ob: activeOb,
      sweep: activeSweep,
      choch: activeChoch,
      ema: activeEma
    },
    indicators: {
      rsi: round(rsi14),
      mfi: round(mfi14),
      atr: round(atr14),
      ema9: round(ema9),
      ema20: round(ema20)
    },
    note: "Strategy B berjalan paralel sebagai eksperimen/live-backtest. Strategy A tidak diganti."
  };
}

function normalizeStrategyBOb(ob, side) {
  if (!ob) return null;
  return {
    ...ob,
    side,
    low: Number(ob.low || 0),
    high: Number(ob.high || 0),
    status: ob.status || "fresh"
  };
}

function isStrategyBObValid(ob, close, atr14, side) {
  if (!ob || !ob.low || !ob.high) return false;
  if (ob.status === "invalid" || ob.expired) return false;
  const buffer = Math.max(atr14 * 0.15, close * 0.00008);
  if (side === "BUY") return close >= ob.low - buffer;
  return close <= ob.high + buffer;
}

function strategyBScore(steps, rsiBoost, mfiBoost) {
  let score = 0;
  if (steps.freshOb) score += 30;
  if (steps.sweep) score += 25;
  if (steps.choch) score += 25;
  if (steps.ema) score += 20;
  if (rsiBoost) score += 5;
  if (mfiBoost) score += 5;
  return Math.min(100, score);
}

function detectStrategyBLiquiditySweep(candles = [], type = "LOW") {
  const data = candles.slice(-22);
  const last = data[data.length - 1];
  if (!last || data.length < 8) return { valid: false, price: 0, level: 0, candleTime: null };
  const prev = data.slice(0, -1);
  const lookback = prev.slice(-12);
  if (type === "LOW") {
    const level = Math.min(...lookback.map((c) => Number(c.low || 0)).filter(Boolean));
    const valid = level && Number(last.low) < level && Number(last.close) > level;
    return { valid: Boolean(valid), price: valid ? Number(last.low) : 0, level: round(level), candleTime: last.time || null };
  }
  const level = Math.max(...lookback.map((c) => Number(c.high || 0)).filter(Boolean));
  const valid = level && Number(last.high) > level && Number(last.close) < level;
  return { valid: Boolean(valid), price: valid ? Number(last.high) : 0, level: round(level), candleTime: last.time || null };
}

function detectStrategyBChoch(candles = [], direction = "BULLISH") {
  const data = candles.slice(-28);
  if (data.length < 14) return { valid: false, level: 0, candleTime: null };
  const last = data[data.length - 1];
  const left = data.slice(0, -1);
  const recent = left.slice(-10);
  const prior = left.slice(-22, -10);
  const recentHigh = Math.max(...recent.map((c) => Number(c.high || 0)));
  const recentLow = Math.min(...recent.map((c) => Number(c.low || 0)));
  const priorHigh = Math.max(...prior.map((c) => Number(c.high || 0)));
  const priorLow = Math.min(...prior.map((c) => Number(c.low || 0)));
  if (direction === "BULLISH") {
    const level = Math.max(recentHigh, priorHigh);
    const valid = Number(last.close) > level || (recentLow > priorLow && Number(last.close) > recentHigh);
    return { valid: Boolean(valid), level: round(level), candleTime: last.time || null };
  }
  const level = Math.min(recentLow, priorLow);
  const valid = Number(last.close) < level || (recentHigh < priorHigh && Number(last.close) < recentLow);
  return { valid: Boolean(valid), level: round(level), candleTime: last.time || null };
}

function buildStrategyBBlockers(steps, direction) {
  if (!steps.freshOb) return [`Menunggu Fresh ${direction === "BUY" ? "Bullish" : "Bearish"} OB M15 valid.`];
  if (!steps.priceInOb) return ["Harga belum kembali masuk ke area OB M15."];
  if (!steps.sweep) return [`Menunggu Liquidity Sweep ${direction === "BUY" ? "Low" : "High"} M1.`];
  if (!steps.choch) return [`Menunggu CHOCH ${direction === "BUY" ? "Bullish" : "Bearish"} M1.`];
  if (!steps.ema) return [`Menunggu konfirmasi EMA 9/20 M1 ${direction === "BUY" ? "bullish" : "bearish"}.`];
  return [];
}

function buildStrategyBReason(action, direction, blockers) {
  if (action === "CALL_BUY") return "SMC AI BUY valid: OB M15, Sweep Low M1, CHOCH Bullish, dan EMA M1 sudah konfirmasi.";
  if (action === "CALL_SELL") return "SMC AI SELL valid: OB M15, Sweep High M1, CHOCH Bearish, dan EMA M1 sudah konfirmasi.";
  if (action.includes("READY")) return `SMC AI ${direction} mulai terbentuk. ${blockers[0] || "Menunggu konfirmasi final."}`;
  return `SMC AI WAIT. ${blockers[0] || "Rangkaian OB → Sweep → CHOCH → EMA belum lengkap."}`;
}

function buildSignalQualityGuardV2(ctx = {}) {
  const market = ctx.market || {};
  const checks = [];
  const blockers = [];
  const warnings = [];
  const bid = Number(market.bid || 0);
  const ask = Number(market.ask || 0);
  const spread = bid > 0 && ask > 0 ? Math.abs(ask - bid) : null;
  const close = Number(ctx.close || 0);
  const atr14 = Number(ctx.atr14 || 0);
  const candleCount = Array.isArray(ctx.m1) ? ctx.m1.length : 0;
  const m15Count = Array.isArray(ctx.m15) ? ctx.m15.length : 0;
  const confidence = Number(ctx.confidence || 0);
  const feedInfo = getSignalFeedFreshness(market);

  const maxSpread = close > 0 ? Math.max(0.8, close * 0.00045) : 2;
  const candleRange = getLastCandleRange(ctx.m1);
  const atrRiskLimit = close > 0 ? close * 0.0014 : 999;
  const candleRiskLimit = atr14 > 0 ? atr14 * 2.8 : 999;

  const feedPassed = feedInfo.ageSec === null || feedInfo.ageSec <= 1800;
  const spreadPassed = spread === null || spread <= maxSpread;
  const isMainM5 = Boolean(ctx.mainM5);
  const dataPassed = isMainM5 ? Boolean(ctx.mainM5?.dataReady) : (candleCount >= 50 && m15Count >= 50);
  const volatilityPassed = atr14 <= atrRiskLimit && candleRange <= candleRiskLimit;
  const confidencePassed = confidence >= 68;
  const setupPassed = Boolean(ctx.buyAllMatch || ctx.sellAllMatch || ctx.readyBuyAllMatch || ctx.readySellAllMatch);
  const obPassed = isMainM5 ? setupPassed : Boolean(ctx.obBuyOk || ctx.obSellOk || ctx.readyBuyAllMatch || ctx.readySellAllMatch || ctx.buyAllMatch || ctx.sellAllMatch);

  checks.push(makeGuardCheck("Live Feed", feedPassed ? "PASS" : "WAIT", feedPassed ? "Data market masih layak dipakai." : "Koneksi market belum fresh."));
  checks.push(makeGuardCheck("Spread", spreadPassed ? "PASS" : "WAIT", spread === null ? "Spread belum terbaca, guard tetap hati-hati." : `Spread ${round(spread)} / batas ${round(maxSpread)}.`));
  checks.push(makeGuardCheck("Data", dataPassed ? "PASS" : "WAIT", dataPassed ? "Data market cukup untuk analisa sinyal." : "Data market belum cukup untuk analisa sinyal."));
  checks.push(makeGuardCheck("Volatility", volatilityPassed ? "PASS" : "WAIT", atr14 ? `ATR ${round(atr14)} masih dalam batas aman.` : "ATR belum terbaca."));
  checks.push(makeGuardCheck("Confidence", confidencePassed ? "PASS" : "WAIT", `Confidence ${confidence || 0}% · minimal 68% untuk CALL.`));
  checks.push(makeGuardCheck("Setup", setupPassed ? "PASS" : "WAIT", setupPassed ? (isMainM5 ? "Setup M5 EMA pullback mulai valid." : "Setup utama mulai cocok.") : "Setup utama belum lengkap."));
  checks.push(makeGuardCheck(isMainM5 ? "Limit Plan" : "OB M15", obPassed ? "PASS" : "WAIT", obPassed ? (isMainM5 ? "Entry limit, TP, dan SL sudah terbentuk." : "Filter OB M15 mendukung setup.") : (isMainM5 ? "Menunggu koreksi EMA 9 dan target swing valid." : "Harga belum dekat OB M15 valid.")));

  if (!feedPassed) blockers.push("koneksi market belum fresh");
  if (!spreadPassed) blockers.push("spread belum aman");
  if (!dataPassed) blockers.push(isMainM5 ? "data candle M5 belum cukup" : "data candle M1/M15 belum cukup");
  if (!volatilityPassed) blockers.push("volatilitas candle/ATR terlalu tinggi");
  if (!confidencePassed) blockers.push("confidence belum cukup untuk CALL");
  if (!setupPassed) blockers.push(isMainM5 ? "EMA 9/20 M5 dan engulfing area EMA belum lengkap" : "setup utama belum lengkap");
  if (!obPassed) blockers.push(isMainM5 ? "rencana limit belum lengkap" : "OB M15 belum mendukung");

  if (spread === null) warnings.push("Spread belum terbaca dari bid/ask.");
  if (feedInfo.ageSec !== null && feedInfo.ageSec > 900) warnings.push("Feed mulai tua, hati-hati sebelum entry.");

  const allowCall = feedPassed && spreadPassed && dataPassed && volatilityPassed && confidencePassed && setupPassed && obPassed;
  const passedCount = checks.filter((c) => c.status === "PASS").length;
  const score = Math.round((passedCount / Math.max(checks.length, 1)) * 100);

  const status = allowCall ? "SAFE" : score >= 70 ? "CAUTION" : "WAIT";
  const label = allowCall ? "Market Safety: SAFE" : score >= 70 ? "Market Safety: CAUTION" : "Market Safety: WAIT";
  const decision = allowCall ? "CALL_ALLOWED" : "CALL_BLOCKED";
  const message = allowCall
    ? "Signal Quality Guard lolos. Market cukup aman untuk CALL jika setup utama valid."
    : `Signal Quality Guard menahan CALL: ${blockers.slice(0, 2).join(" dan ") || "market belum ideal"}.`;

  return {
    version: "10X-signal-quality-guard-v2",
    status,
    label,
    decision,
    allowCall,
    score,
    passedCount,
    totalChecks: checks.length,
    blockers,
    warnings,
    checks,
    metrics: {
      spread: spread === null ? null : round(spread),
      maxSpread: round(maxSpread),
      atr14: round(atr14),
      candleRange: round(candleRange),
      feedAgeSec: feedInfo.ageSec,
      feedTime: feedInfo.timeText || null,
      confidence
    },
    message
  };
}

function makeGuardCheck(name, status, note) {
  return { name, status, note };
}

function getLastCandleRange(candles = []) {
  const last = Array.isArray(candles) ? candles[candles.length - 1] : null;
  if (!last) return 0;
  return Math.abs(Number(last.high || 0) - Number(last.low || 0));
}

function getSignalFeedFreshness(market = {}) {
  const timeValue = market.receivedAt || market.lastCandleTime || market.serverTime || market.updatedAt || market.time || null;
  const ms = new Date(timeValue || 0).getTime();
  if (!timeValue || Number.isNaN(ms) || ms <= 0) return { ageSec: null, timeText: timeValue || null };
  return { ageSec: Math.max(0, Math.round((Date.now() - ms) / 1000)), timeText: timeValue };
}

function buildHumanSignalReason(ctx = {}) {
  const direction = ctx.finalSignal?.includes("BUY") ? "BUY" : ctx.finalSignal?.includes("SELL") ? "SELL" : "WAIT";
  const isCall = ctx.callStage === "CALL";
  const isReady = ctx.callStage === "READY";

  const title = isCall
    ? `CALL ${direction} valid.`
    : isReady
      ? `${ctx.signalLabel || "READY"}. Belum entry penuh, tunggu candle konfirmasi.`
      : "Belum ada CALL valid.";

  const biasLine = buildBiasLine(ctx);
  const emaLine = buildEmaLine(ctx);
  const rsiLine = buildRsiLine(ctx, direction);
  const mfiLine = buildMfiLine(ctx, direction);
  const obLine = buildObLine(ctx, direction);
  const riskLine = buildRiskLine(ctx);
  const guardLine = ctx.qualityGuard?.allowCall
    ? "Quality Guard: market lolos safety check."
    : ctx.qualityGuard?.message || "Quality Guard: menunggu market lebih aman.";

  const checklist = [
    emaLine,
    rsiLine,
    mfiLine,
    obLine,
    riskLine,
    guardLine
  ].filter(Boolean);

  const blockers = buildSignalBlockers(ctx, direction);
  const action = isCall
    ? `Aksi: ${direction} boleh dipantau sesuai entry, SL, dan TP di dashboard.`
    : isReady
      ? "Aksi: tunggu cross/close candle berikutnya supaya sinyal tidak masuk terlalu cepat."
      : blockers.length
        ? `Aksi: tunggu ${blockers[0].toLowerCase()}.`
        : "Aksi: tunggu kombinasi EMA, RSI, MFI, dan OB M15 lebih rapi.";

  const summaryParts = [title, biasLine, ...checklist.slice(0, 4), action];

  return {
    version: "10H-human-readable-reason-builder",
    title,
    summary: summaryParts.join(" "),
    action,
    direction,
    bias: biasLine,
    checklist,
    blockers,
    score: {
      buy: round(ctx.buyScore),
      sell: round(ctx.sellScore),
      confidence: ctx.confidence
    },
    raw: (ctx.legacyReasons || []).slice(0, 8)
  };
}

function buildBiasLine(ctx = {}) {
  if (Number(ctx.ema9) > Number(ctx.ema20)) {
    return "Bias utama masih bullish karena EMA 9 berada di atas EMA 20.";
  }

  if (Number(ctx.ema9) < Number(ctx.ema20)) {
    return "Bias utama masih bearish karena EMA 9 berada di bawah EMA 20.";
  }

  return "Bias utama masih netral karena EMA 9 dan EMA 20 sangat rapat.";
}

function buildEmaLine(ctx = {}) {
  if (ctx.bullishCrossNow) return "EMA: bullish cross baru terjadi, momentum BUY mulai aktif.";
  if (ctx.bearishCrossNow) return "EMA: bearish cross baru terjadi, momentum SELL mulai aktif.";
  if (ctx.readyBuy) return "EMA: jarak EMA makin dekat ke bullish cross, status masih siap-siap BUY.";
  if (ctx.readySell) return "EMA: jarak EMA makin dekat ke bearish cross, status masih siap-siap SELL.";
  if (Number(ctx.ema9) > Number(ctx.ema20)) return "EMA: trend pendek masih condong naik, tapi belum tentu cukup untuk CALL.";
  if (Number(ctx.ema9) < Number(ctx.ema20)) return "EMA: trend pendek masih condong turun, tapi belum tentu cukup untuk CALL.";
  return "EMA: belum memberi arah yang jelas.";
}

function buildRsiLine(ctx = {}, direction = "WAIT") {
  const rsi = round(ctx.rsi14);
  if (direction === "BUY") {
    return ctx.rsiBuyOk ? `RSI: ${rsi} masih sehat untuk BUY.` : `RSI: ${rsi} belum ideal untuk BUY.`;
  }
  if (direction === "SELL") {
    return ctx.rsiSellOk ? `RSI: ${rsi} masih sehat untuk SELL.` : `RSI: ${rsi} belum ideal untuk SELL.`;
  }
  if (ctx.rsiBuyOk && !ctx.rsiSellOk) return `RSI: ${rsi} lebih mendukung BUY, tapi filter lain belum lengkap.`;
  if (ctx.rsiSellOk && !ctx.rsiBuyOk) return `RSI: ${rsi} lebih mendukung SELL, tapi filter lain belum lengkap.`;
  return `RSI: ${rsi} masih netral/belum kuat.`;
}

function buildMfiLine(ctx = {}, direction = "WAIT") {
  const mfiValue = round(ctx.mfi14);
  if (direction === "BUY") {
    return ctx.mfiBuyOk ? `MFI: ${mfiValue} menunjukkan buyer masih mendukung.` : `MFI: ${mfiValue} belum cukup mendukung buyer.`;
  }
  if (direction === "SELL") {
    return ctx.mfiSellOk ? `MFI: ${mfiValue} menunjukkan seller masih mendukung.` : `MFI: ${mfiValue} belum cukup mendukung seller.`;
  }
  if (ctx.mfiBuyOk && !ctx.mfiSellOk) return `MFI: ${mfiValue} condong ke buyer, tapi belum cukup untuk CALL.`;
  if (ctx.mfiSellOk && !ctx.mfiBuyOk) return `MFI: ${mfiValue} condong ke seller, tapi belum cukup untuk CALL.`;
  return `MFI: ${mfiValue} belum memberi dorongan jelas.`;
}

function buildObLine(ctx = {}, direction = "WAIT") {
  if (!ctx.m15Ready) return "OB M15: belum aktif karena data M15 belum cukup.";

  if (direction === "BUY") {
    if (ctx.obBuyOk) return `OB M15: harga dekat Bullish OB fresh/valid (${ctx.bullObStatus}).`;
    return "OB M15: harga belum berada di area Bullish OB valid.";
  }

  if (direction === "SELL") {
    if (ctx.obSellOk) return `OB M15: harga dekat Bearish OB fresh/valid (${ctx.bearObStatus}).`;
    return "OB M15: harga belum berada di area Bearish OB valid.";
  }

  if (ctx.obBuyOk) return `OB M15: area Bullish OB masih relevan (${ctx.bullObStatus}).`;
  if (ctx.obSellOk) return `OB M15: area Bearish OB masih relevan (${ctx.bearObStatus}).`;
  return "OB M15: belum ada area OB valid yang benar-benar dekat harga.";
}

function buildRiskLine(ctx = {}) {
  const atrValue = Number(ctx.atr14 || 0);
  const close = Number(ctx.close || 0);
  if (!Number.isFinite(atrValue) || !Number.isFinite(close) || atrValue <= 0 || close <= 0) {
    return "Risk: data volatilitas belum cukup rapi.";
  }

  const atrPct = (atrValue / close) * 100;
  if (atrPct >= 0.18) return `Risk: volatilitas cukup tinggi, ukuran lot harus lebih hati-hati. ATR sekitar ${round(atrValue)}.`;
  if (atrPct <= 0.04) return `Risk: market relatif pelan, tunggu candle konfirmasi agar tidak fake signal. ATR sekitar ${round(atrValue)}.`;
  return `Risk: volatilitas masih normal. ATR sekitar ${round(atrValue)}.`;
}

function buildSignalBlockers(ctx = {}, direction = "WAIT") {
  const blockers = [];

  if (direction === "BUY") {
    if (!ctx.bullishCrossNow && !ctx.readyBuy) blockers.push("EMA BUY belum cross/ready");
    if (!ctx.rsiBuyOk) blockers.push("RSI BUY belum ideal");
    if (!ctx.mfiBuyOk) blockers.push("MFI BUY belum mendukung");
    if (!ctx.obBuyOk) blockers.push("harga belum dekat Bullish OB M15");
  } else if (direction === "SELL") {
    if (!ctx.bearishCrossNow && !ctx.readySell) blockers.push("EMA SELL belum cross/ready");
    if (!ctx.rsiSellOk) blockers.push("RSI SELL belum ideal");
    if (!ctx.mfiSellOk) blockers.push("MFI SELL belum mendukung");
    if (!ctx.obSellOk) blockers.push("harga belum dekat Bearish OB M15");
  } else {
    if (!ctx.bullishCrossNow && !ctx.bearishCrossNow && !ctx.readyBuy && !ctx.readySell) blockers.push("EMA belum cross atau mendekati cross");
    if (!ctx.rsiBuyOk && !ctx.rsiSellOk) blockers.push("RSI belum masuk zona ideal");
    if (!ctx.mfiBuyOk && !ctx.mfiSellOk) blockers.push("MFI belum mendukung arah jelas");
    if (!ctx.obBuyOk && !ctx.obSellOk) blockers.push("harga belum dekat OB M15 valid");
  }

  if (!ctx.m15Ready) blockers.push("data M15 belum cukup untuk validasi OB");
  return blockers.slice(0, 6);
}

function buildM1ScalpingStrategy(candles, closes, context = {}) {
  return buildM5EngulfingLimitScalp(candles, context);
}

function buildM5EngulfingLimitScalp(m5Candles = [], context = {}) {
  const m5 = clean(m5Candles);
  const last = m5[m5.length - 1];
  const prev = m5[m5.length - 2];

  if (!last || !prev || m5.length < 20) {
    return {
      mode: "M5_ENGULFING_LIMIT_SCALP",
      activeRule: "M5_SWING_ENGULFING_EMA_9_20_LIMIT",
      action: "WAIT",
      label: "M5 SCALP WAIT",
      orderType: "WAIT",
      score: 0, confidence: 0, entry: 0, sl: 0, tp: 0,
      support: 0, resistance: 0, ema9: 0, ema20: 0, emaTrend: "WAIT",
      zone: "WAIT", pattern: "NONE", atr: 0, timeframe: "M5",
      sourceTimeframe: context.sourceTimeframe || "M1_AGGREGATED_TO_M5", maxPending: 4, maxBuyPending: 2, maxSellPending: 2,
      reason: "Menunggu minimal 20 candle M5 untuk membaca struktur, swing, EMA 9/20, dan limit setup.",
      checklist: []
    };
  }

  const closes = m5.map((c) => Number(c.close));
  const ema9Value = Number(ema(closes, 9));
  const ema20Value = Number(ema(closes, 20));
  const atrValue = Number(atr(m5, 14) || Math.max(Math.abs(last.high - last.low), 1));
  const structure = detectM5StructureForEngulfing(m5, atrValue);
  const bullishEngulfing = isBullishEngulfing(prev, last);
  const bearishEngulfing = isBearishEngulfing(prev, last);
  const closeAboveEma = Number(last.close) > ema9Value && Number(last.close) > ema20Value;
  const closeBelowEma = Number(last.close) < ema9Value && Number(last.close) < ema20Value;
  const swingBuffer = Math.max(atrValue * 0.45, Number(last.close) * 0.0001);
  const atSwingLow = Number(last.low) <= Number(structure.previousSwingLow) + swingBuffer;
  const atSwingHigh = Number(last.high) >= Number(structure.previousSwingHigh) - swingBuffer;

  let buyScore = 0;
  let sellScore = 0;
  const checklist = [];
  if (bullishEngulfing) { buyScore += 30; checklist.push("Bullish engulfing M5 valid"); }
  if (bearishEngulfing) { sellScore += 30; checklist.push("Bearish engulfing M5 valid"); }
  if (atSwingLow) { buyScore += 25; checklist.push("Engulfing berada di area swing low M5"); }
  if (atSwingHigh) { sellScore += 25; checklist.push("Engulfing berada di area swing high M5"); }
  if (closeAboveEma) { buyScore += 25; checklist.push("Close candle di atas EMA 9/20"); }
  if (closeBelowEma) { sellScore += 25; checklist.push("Close candle di bawah EMA 9/20"); }

  const rsi = Number(context.rsi14 || rsiWilder(closes, 14));
  const mfiValue = Number(context.mfi14 || mfi(m5, 14));
  if (rsi > 50) { buyScore += 5; checklist.push("RSI booster BUY"); }
  if (rsi < 50) { sellScore += 5; checklist.push("RSI booster SELL"); }
  if (mfiValue > 50) { buyScore += 5; checklist.push("MFI booster BUY"); }
  if (mfiValue < 50) { sellScore += 5; checklist.push("MFI booster SELL"); }

  const buyValid = bullishEngulfing && atSwingLow && closeAboveEma;
  const sellValid = bearishEngulfing && atSwingHigh && closeBelowEma;
  let action = "WAIT", label = "M5 SCALP WAIT", orderType = "WAIT", entry = 0, sl = 0, tp = 0, zone = "WAIT";
  let pattern = bullishEngulfing ? "BULLISH_ENGULFING" : bearishEngulfing ? "BEARISH_ENGULFING" : "NONE";
  let score = Math.max(buyScore, sellScore);

  if (buyValid) {
    action = "SCALP_BUY"; label = "M5 BUY LIMIT"; orderType = "BUY_LIMIT"; zone = "SWING_LOW"; pattern = "BULLISH_ENGULFING";
    entry = Number(last.open);
    sl = Number(structure.previousSwingLow) - atrValue * 1.5;
    const risk = Math.abs(entry - sl);
    tp = entry + risk;
  } else if (sellValid) {
    action = "SCALP_SELL"; label = "M5 SELL LIMIT"; orderType = "SELL_LIMIT"; zone = "SWING_HIGH"; pattern = "BEARISH_ENGULFING";
    entry = Number(last.open);
    sl = Number(structure.previousSwingHigh) + atrValue * 1.5;
    const risk = Math.abs(sl - entry);
    tp = entry - risk;
  } else {
    if (atSwingLow) zone = "NEAR_SWING_LOW";
    else if (atSwingHigh) zone = "NEAR_SWING_HIGH";
  }

  return {
    mode: "M5_ENGULFING_LIMIT_SCALP",
    activeRule: "M5_SWING_ENGULFING_EMA_9_20_LIMIT",
    action, label, orderType,
    score: Math.min(100, Math.round(score)),
    confidence: Math.min(94, Math.max(40, Math.round(score))),
    entry: round(entry), sl: round(sl), tp: round(tp),
    support: round(structure.previousSwingLow), resistance: round(structure.previousSwingHigh),
    previousSwingLow: round(structure.previousSwingLow), previousSwingHigh: round(structure.previousSwingHigh),
    ema9: round(ema9Value), ema20: round(ema20Value),
    emaTrend: closeAboveEma ? "PRICE_ABOVE_EMA_9_20" : closeBelowEma ? "PRICE_BELOW_EMA_9_20" : "PRICE_BETWEEN_EMA",
    zone, pattern, atr: round(atrValue), timeframe: "M5", sourceTimeframe: context.sourceTimeframe || "M1_AGGREGATED_TO_M5",
    maxPending: 4, maxBuyPending: 2, maxSellPending: 2, rr: "1:1", tpMethod: "RR_1_1",
    slMethod: "previous_m5_structure_plus_1_5_atr",
    engulfingCandle: { time: last.time, open: round(last.open), high: round(last.high), low: round(last.low), close: round(last.close) },
    nearSupport: atSwingLow, nearResistance: atSwingHigh, bullishEngulfing, bearishEngulfing, emaBullish: closeAboveEma, emaBearish: closeBelowEma,
    reason: buildM5EngulfingLimitReason({ action, buyScore, sellScore, bullishEngulfing, bearishEngulfing, atSwingLow, atSwingHigh, closeAboveEma, closeBelowEma, checklist }),
    checklist: checklist.slice(0, 9)
  };
}

function aggregateCandlesToM5(candles) {
  const cleanCandles = clean(candles);
  if (cleanCandles.length < 5) return [];
  const groups = [];
  let current = null;
  for (let i = 0; i < cleanCandles.length; i++) {
    const c = cleanCandles[i];
    const t = Date.parse(c.time || c.datetime || c.timestamp || "");
    let key;
    if (Number.isFinite(t)) {
      const d = new Date(t);
      d.setUTCSeconds(0, 0);
      d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5);
      key = d.toISOString();
    } else {
      key = `idx_${Math.floor(i / 5)}`;
    }
    if (!current || current.key !== key) {
      if (current) groups.push(current);
      current = { key, time: key.startsWith("idx_") ? c.time : key, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || c.tick_volume || 0), sourceCount: 1 };
    } else {
      current.high = Math.max(current.high, Number(c.high));
      current.low = Math.min(current.low, Number(c.low));
      current.close = Number(c.close);
      current.volume += Number(c.volume || c.tick_volume || 0);
      current.sourceCount += 1;
      current.time = key.startsWith("idx_") ? c.time : key;
    }
  }
  if (current) groups.push(current);
  return groups.filter((g) => Number.isFinite(g.open) && Number.isFinite(g.high) && Number.isFinite(g.low) && Number.isFinite(g.close)).slice(-160);
}

function detectM5StructureForEngulfing(candles, atrValue) {
  const before = candles.slice(-14, -1);
  const lows = before.map((c) => Number(c.low)).filter(Number.isFinite);
  const highs = before.map((c) => Number(c.high)).filter(Number.isFinite);
  return {
    previousSwingLow: lows.length ? Math.min(...lows) : Number(candles[candles.length - 2]?.low || candles[candles.length - 1]?.low || 0),
    previousSwingHigh: highs.length ? Math.max(...highs) : Number(candles[candles.length - 2]?.high || candles[candles.length - 1]?.high || 0),
    method: "LOWEST_HIGH_LOW_LAST_13_M5",
    atr: atrValue
  };
}

function buildM5EngulfingLimitReason(data) {
  const buy = Math.round(data.buyScore);
  const sell = Math.round(data.sellScore);
  const confirmations = data.checklist.length ? data.checklist.slice(0, 7).join(" • ") : "setup belum lengkap";
  if (data.action === "SCALP_BUY") return `🚀 M5 BUY LIMIT siap. Bullish engulfing muncul di swing low, close di atas EMA 9/20. Entry limit di open engulfing, SL struktur M5 sebelumnya + 1.5 ATR, TP RR 1:1. Strength ${buy}/100. ${confirmations}.`;
  if (data.action === "SCALP_SELL") return `🔻 M5 SELL LIMIT siap. Bearish engulfing muncul di swing high, close di bawah EMA 9/20. Entry limit di open engulfing, SL struktur M5 sebelumnya + 1.5 ATR, TP RR 1:1. Strength ${sell}/100. ${confirmations}.`;
  if (data.bullishEngulfing && !data.atSwingLow) return "Bullish engulfing M5 terdeteksi, tapi belum berada di area swing low.";
  if (data.bearishEngulfing && !data.atSwingHigh) return "Bearish engulfing M5 terdeteksi, tapi belum berada di area swing high.";
  if (data.atSwingLow && !data.bullishEngulfing) return "Harga berada di area swing low M5, tapi belum ada bullish engulfing valid.";
  if (data.atSwingHigh && !data.bearishEngulfing) return "Harga berada di area swing high M5, tapi belum ada bearish engulfing valid.";
  if (data.bullishEngulfing && !data.closeAboveEma) return "Bullish engulfing M5 ada, tapi close belum di atas EMA 9/20.";
  if (data.bearishEngulfing && !data.closeBelowEma) return "Bearish engulfing M5 ada, tapi close belum di bawah EMA 9/20.";
  return `M5 Scalp menunggu setup lengkap: engulfing di swing low/high, close di sisi EMA 9/20 yang benar, lalu entry limit di open candle engulfing. BUY ${buy}/100 vs SELL ${sell}/100.`;
}


function findLastTouchCandle(candles, level, side, zoneBuffer) {
  const price = Number(level);
  if (!Number.isFinite(price)) return null;

  const lookback = candles.slice(-18);

  for (let i = lookback.length - 1; i >= 0; i--) {
    const c = lookback[i];

    if (side === "support") {
      const touchedSupport =
        Number(c.low) <= price + zoneBuffer &&
        Number(c.high) >= price - zoneBuffer;

      if (touchedSupport) return c;
    }

    if (side === "resistance") {
      const touchedResistance =
        Number(c.high) >= price - zoneBuffer &&
        Number(c.low) <= price + zoneBuffer;

      if (touchedResistance) return c;
    }
  }

  return null;
}

function detectM1StructureZones(candles, atrValue) {
  const swingHighs = [];
  const swingLows = [];
  const lastClose = Number(candles[candles.length - 1]?.close || 0);

  // Support = last swing low M1 di bawah harga sekarang.
  // Resistance = last swing high M1 di atas harga sekarang.
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    const left = candles.slice(i - 2, i);
    const right = candles.slice(i + 1, i + 3);

    const isHigh = left.every((x) => c.high >= x.high) && right.every((x) => c.high >= x.high);
    const isLow = left.every((x) => c.low <= x.low) && right.every((x) => c.low <= x.low);

    if (isHigh) {
      swingHighs.push({
        price: c.high,
        time: c.time,
        index: i
      });
    }

    if (isLow) {
      swingLows.push({
        price: c.low,
        time: c.time,
        index: i
      });
    }
  }

  const supportsBelow = swingLows.filter((x) => x.price <= lastClose);
  const resistancesAbove = swingHighs.filter((x) => x.price >= lastClose);

  const lastSupport = supportsBelow.length
    ? supportsBelow[supportsBelow.length - 1]
    : swingLows.length
      ? swingLows[swingLows.length - 1]
      : {
          price: Math.min(...candles.slice(-20).map((c) => c.low)),
          time: candles[candles.length - 1]?.time || null,
          index: candles.length - 1
        };

  const lastResistance = resistancesAbove.length
    ? resistancesAbove[resistancesAbove.length - 1]
    : swingHighs.length
      ? swingHighs[swingHighs.length - 1]
      : {
          price: Math.max(...candles.slice(-20).map((c) => c.high)),
          time: candles[candles.length - 1]?.time || null,
          index: candles.length - 1
        };

  return {
    support: lastSupport.price,
    resistance: lastResistance.price,
    supportTime: lastSupport.time || null,
    resistanceTime: lastResistance.time || null,
    supportIndex: lastSupport.index,
    resistanceIndex: lastResistance.index,
    supportSource: "LAST_M1_SWING_LOW",
    resistanceSource: "LAST_M1_SWING_HIGH",
    swingLowCount: swingLows.length,
    swingHighCount: swingHighs.length
  };
}

function isBullishEngulfing(prev, curr) {
  const prevBear = prev.close < prev.open;
  const currBull = curr.close > curr.open;

  if (!prevBear || !currBull) return false;

  const prevBodyLow = Math.min(prev.open, prev.close);
  const prevBodyHigh = Math.max(prev.open, prev.close);
  const currBodyLow = Math.min(curr.open, curr.close);
  const currBodyHigh = Math.max(curr.open, curr.close);

  return currBodyLow <= prevBodyLow && currBodyHigh >= prevBodyHigh;
}

function isBearishEngulfing(prev, curr) {
  const prevBull = prev.close > prev.open;
  const currBear = curr.close < curr.open;

  if (!prevBull || !currBear) return false;

  const prevBodyLow = Math.min(prev.open, prev.close);
  const prevBodyHigh = Math.max(prev.open, prev.close);
  const currBodyLow = Math.min(curr.open, curr.close);
  const currBodyHigh = Math.max(curr.open, curr.close);

  return currBodyHigh >= prevBodyHigh && currBodyLow <= prevBodyLow;
}

function buildSrEngulfingEmaReason(data) {
  const buy = Math.round(data.buyScore);
  const sell = Math.round(data.sellScore);
  const confirmations = data.checklist.length ? data.checklist.slice(0, 6).join(" • ") : "belum ada setup valid";

  if (data.action === "SCALP_BUY") {
    return `🚀 M1 scalp BUY valid. EMA 9 di atas EMA 20, harga di support M1, dan bullish engulfing kebaca. BUY power ${buy}/100 vs SELL ${sell}/100. SL pakai candle touch + 1.5 ATR, TP RR 1:1.25. Konfirmasi: ${confirmations}.`;
  }

  if (data.action === "SCALP_SELL") {
    return `🔻 M1 scalp SELL valid. EMA 9 di bawah EMA 20, harga di resistance M1, dan bearish engulfing kebaca. SELL power ${sell}/100 vs BUY ${buy}/100. SL pakai candle touch + 1.5 ATR, TP RR 1:1.25. Konfirmasi: ${confirmations}.`;
  }

  if (data.emaBullish && data.nearSupport && !data.bullishEngulfing) {
    return `👀 EMA M1 bullish dan harga dekat support, tapi belum ada bullish engulfing. BUY power ${buy}/100. Tunggu candle reversal yang lebih jelas.`;
  }

  if (data.emaBearish && data.nearResistance && !data.bearishEngulfing) {
    return `👀 EMA M1 bearish dan harga dekat resistance, tapi belum ada bearish engulfing. SELL power ${sell}/100. Tunggu candle reject yang lebih jelas.`;
  }

  if (data.nearSupport && !data.emaBullish) {
    return `⚠️ Harga dekat support M1, tapi EMA 9/20 belum bullish. Rule scalp belum izinkan BUY.`;
  }

  if (data.nearResistance && !data.emaBearish) {
    return `⚠️ Harga dekat resistance M1, tapi EMA 9/20 belum bearish. Rule scalp belum izinkan SELL.`;
  }

  return `😴 M1 scalp masih nunggu setup lengkap. Butuh EMA 9/20 searah + support/resistance M1 + engulfing. Support ${round(data.support)}, Resistance ${round(data.resistance)}.`;
}


async function maybeSaveScalpHistory(env, dbUrl, signal, market) {
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };

  const scalp = signal.strategy?.scalping || null;
  const isValidScalp = scalp?.action === "SCALP_BUY" || scalp?.action === "SCALP_SELL";

  if (!isValidScalp) {
    return { ok: false, skipped: "not-valid-scalp" };
  }

  const candleKey = signal.candleTime || market?.serverTime || market?.receivedAt || new Date().toISOString();
  const scalpSignal = scalp.action === "SCALP_BUY" ? "BUY" : "SELL";

  const scalpId = [
    market?.symbol || signal.pair || "XAUUSD",
    "SCALP_M5_LIMIT",
    scalpSignal,
    scalp?.engulfingCandle?.time || candleKey
  ]
    .join("_")
    .replaceAll(" ", "_")
    .replaceAll(":", "-")
    .replaceAll(".", "-")
    .replaceAll("/", "-");

  const existing = await fbGet(dbUrl, `/xauusd/scalpHistory/${scalpId}`);

  if (existing?.id === scalpId) {
    return { ok: true, skipped: "duplicate-scalp", scalpId };
  }

  const payload = {
    id: scalpId,
    type: "SCALP_M5_LIMIT",
    pair: market?.symbol || signal.pair || "XAUUSD",
    signal: scalpSignal,
    action: scalp.action,
    label: scalp.label,
    entry: scalp.entry,
    sl: scalp.sl,
    tp: scalp.tp,
    score: scalp.score,
    confidence: scalp.confidence,
    support: scalp.support ?? null,
    resistance: scalp.resistance ?? null,
    previousSwingLow: scalp.previousSwingLow ?? null,
    previousSwingHigh: scalp.previousSwingHigh ?? null,
    orderType: scalp.orderType || null,
    timeframe: "M5",
    sourceTimeframe: scalp.sourceTimeframe || "M1_AGGREGATED_TO_M5",
    rr: scalp.rr || "1:1",
    pattern: scalp.pattern ?? null,
    zone: scalp.zone ?? null,
    atr: scalp.atr ?? null,
    slMethod: scalp.slMethod || "previous_m5_structure_plus_1_5_atr",
    supportTouchCandle: scalp.supportTouchCandle || null,
    resistanceTouchCandle: scalp.resistanceTouchCandle || null,
    engulfingCandle: scalp.engulfingCandle || null,
    reason: scalp.reason || "",
    candleTime: signal.candleTime || null,
    serverTime: market?.serverTime || null,
    createdAt: new Date().toISOString(),
    status: "PENDING",
    result: null,
    closedAt: null,
    note: ""
  };

  await expireOldM5PendingSlots(dbUrl, scalpSignal, scalpId);
  await fbPut(dbUrl, `/xauusd/scalpHistory/${scalpId}`, payload);
  await trimFirebaseList(dbUrl, "/xauusd/scalpHistory", 80);

  return { ok: true, scalpId };
}

async function expireOldM5PendingSlots(dbUrl, signal, newId) {
  const raw = await fbGet(dbUrl, "/xauusd/scalpHistory");
  const items = Object.values(raw || {})
    .filter(Boolean)
    .filter((item) => String(item.type || "").includes("SCALP_M5") || String(item.mode || "").includes("M5"))
    .filter((item) => String(item.signal || "").toUpperCase() === String(signal || "").toUpperCase())
    .filter((item) => ["PENDING", "OPEN", "RUNNING"].includes(String(item.status || "PENDING").toUpperCase()))
    .filter((item) => !["WIN", "LOSS", "BE", "EXPIRED"].includes(String(item.result || "").toUpperCase()))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

  while (items.length >= 2) {
    const oldest = items.shift();
    if (!oldest?.id || oldest.id === newId) continue;
    await fbPut(dbUrl, `/xauusd/scalpHistory/${oldest.id}`, {
      ...oldest,
      status: "CLOSED",
      result: "EXPIRED",
      closedAt: new Date().toISOString(),
      note: "Expired otomatis karena muncul setup M5 engulfing limit baru dan slot pending sudah penuh."
    });
  }
}


async function maybeSaveStrategyBHistory(env, dbUrl, signal, market) {
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };
  const controls = await getStrategyControls(dbUrl);
  if (controls.strategyBLiveBacktest === false) return { ok: false, skipped: "strategy-b-live-backtest-master-off" };

  const strategyB = signal.strategyB || signal.strategy?.strategyB || null;
  const isValid = strategyB?.action === "CALL_BUY" || strategyB?.action === "CALL_SELL";
  if (!isValid) return { ok: false, skipped: "strategy-b-not-call" };

  const direction = strategyB.action === "CALL_BUY" ? "BUY" : "SELL";
  const entry = Number(strategyB.entry || signal.entry || market?.bid || 0);
  const candleKey = signal.candleTime || market?.serverTime || market?.receivedAt || new Date().toISOString();
  const baseId = [
    market?.symbol || signal.pair || "XAUUSD",
    "STRATEGY_B_SMC_AI",
    direction,
    candleKey
  ]
    .join("_")
    .replaceAll(" ", "_")
    .replaceAll(":", "-")
    .replaceAll(".", "-")
    .replaceAll("/", "-");

  const existing = await fbGet(dbUrl, `/xauusd/strategyB/history/${baseId}`);
  if (existing?.id === baseId) return { ok: true, skipped: "duplicate-strategy-b", strategyBId: baseId };

  const raw = await fbGet(dbUrl, "/xauusd/strategyB/history");
  const recent = Object.values(raw || {})
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 20);

  const duplicateWindowMs = 15 * 60 * 1000;
  const now = Date.now();
  const nearDuplicate = recent.find((item) => {
    const itemTime = new Date(item.createdAt || item.candleTime || 0).getTime();
    const sameDirection = item.signal === direction || item.direction === direction;
    const entryDistance = Math.abs(Number(item.entry || 0) - entry);
    return sameDirection && Number.isFinite(itemTime) && (now - itemTime) <= duplicateWindowMs && entryDistance <= 0.8;
  });

  if (nearDuplicate?.id) {
    return { ok: true, skipped: "near-duplicate-strategy-b", strategyBId: nearDuplicate.id };
  }

  const payload = {
    id: baseId,
    type: "STRATEGY_B_SMC_AI",
    strategyKey: "strategyB",
    strategyName: "SMC AI",
    mode: "LIVE_BACKTEST_ONLY",
    pair: market?.symbol || signal.pair || "XAUUSD",
    signal: direction,
    direction,
    action: strategyB.action,
    label: strategyB.label || `SMC AI ${direction}`,
    entry: round(entry),
    sl: round(strategyB.sl || 0),
    tp: round(strategyB.tp || 0),
    rr: strategyB.rr || "1:2",
    confidence: strategyB.confidence || 0,
    score: strategyB.confidence || 0,
    reason: strategyB.reason || "",
    candleTime: signal.candleTime || null,
    serverTime: market?.serverTime || null,
    createdAt: new Date().toISOString(),
    status: "PENDING",
    result: null,
    closedAt: null,
    note: "Strategy B live-backtest only. Tidak mempengaruhi Strategy A.",
    smcSnapshot: {
      checklist: strategyB.checklist || [],
      blockers: strategyB.blockers || [],
      active: strategyB.active || null,
      buy: strategyB.buy || null,
      sell: strategyB.sell || null,
      indicators: strategyB.indicators || null
    },
    statsSnapshot: {
      freshOb: Boolean(strategyB.active?.ob),
      sweep: Boolean(strategyB.active?.sweep?.valid),
      choch: Boolean(strategyB.active?.choch?.valid),
      ema: Boolean(strategyB.active?.ema),
      rsi: strategyB.indicators?.rsi ?? null,
      mfi: strategyB.indicators?.mfi ?? null,
      atr: strategyB.indicators?.atr ?? null
    }
  };

  await fbPut(dbUrl, `/xauusd/strategyB/history/${baseId}`, payload);

  const autoAdminAlert = await maybeSendStrategyBAutoAdminAlert(env, dbUrl, payload);
  const premiumUserAlert = await maybeSendStrategyBPremiumUserAlert(env, dbUrl, payload);

  if (autoAdminAlert?.ok || autoAdminAlert?.skipped || autoAdminAlert?.error || premiumUserAlert?.ok || premiumUserAlert?.skipped || premiumUserAlert?.error) {
    await fbPut(dbUrl, `/xauusd/strategyB/history/${baseId}`, {
      ...payload,
      strategyBAlertSent: Boolean(autoAdminAlert.ok),
      strategyBAlertSentAt: autoAdminAlert.sentAt || null,
      strategyBAlertMode: autoAdminAlert.mode || "ADMIN_MONITORING_ONLY",
      strategyBAlertStatus: autoAdminAlert.ok ? "SENT" : "SKIPPED",
      strategyBAlertSkipped: autoAdminAlert.skipped || null,
      strategyBAlertError: autoAdminAlert.error || null,
      strategyBPremiumAlertSent: Boolean(premiumUserAlert.ok),
      strategyBPremiumAlertSentAt: premiumUserAlert.sentAt || null,
      strategyBPremiumAlertMode: premiumUserAlert.mode || "PREMIUM_USER_ALERT",
      strategyBPremiumAlertStatus: premiumUserAlert.ok ? "SENT" : "SKIPPED",
      strategyBPremiumAlertSkipped: premiumUserAlert.skipped || null,
      strategyBPremiumAlertRecipients: premiumUserAlert.successCount || 0,
      strategyBPremiumAlertTotalRecipients: premiumUserAlert.totalRecipients || 0,
      strategyBPremiumAlertError: premiumUserAlert.error || null
    });
  }

  await trimFirebaseList(dbUrl, "/xauusd/strategyB/history", 80);

  return { ok: true, strategyBId: baseId, autoAdminAlert };
}


async function maybeSendStrategyBAutoAdminAlert(env, dbUrl, item) {
  const enabled = String(env.STRATEGY_B_AUTO_ADMIN_ALERT_ENABLED ?? "true").toLowerCase() !== "false";
  const controls = await getStrategyControls(dbUrl);
  if (!enabled) return { ok: false, skipped: "strategy-b-auto-admin-alert-disabled" };
  if (controls.strategyBAdminAlert === false) return { ok: false, skipped: "strategy-b-admin-alert-master-off" };
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, skipped: "telegram-bot-token-missing" };
  if (!env.TELEGRAM_CHAT_ID) return { ok: false, skipped: "telegram-admin-chat-id-missing" };
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };

  const alertKey = item?.id || [item?.pair || "XAUUSD", "STRATEGY_B", item?.direction || item?.signal || "CALL", item?.candleTime || item?.createdAt || Date.now()].join("|");
  const safeAlertKey = safeKey(alertKey);
  const existingAlert = await fbGet(dbUrl, `/xauusd/strategyB/telegramAlerts/${safeAlertKey}`);
  if (existingAlert?.ok) {
    return { ok: true, skipped: "duplicate-strategy-b-admin-alert", alertKey };
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || env.DASHBOARD_URL || "https://www.xauaisignal.online";
  const message = buildStrategyBAutoAdminTelegramMessage(item, dashboardUrl);
  const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message, dashboardUrl);
  const sentAt = new Date().toISOString();

  await fbPut(dbUrl, `/xauusd/strategyB/telegramAlerts/${safeAlertKey}`, {
    alertKey,
    strategyId: item?.id || null,
    type: "STRATEGY_B_AUTO_ADMIN_ALERT",
    mode: "ADMIN_MONITORING_ONLY",
    direction: item?.direction || item?.signal || null,
    pair: item?.pair || "XAUUSD",
    ok: Boolean(sent.ok),
    status: sent.status || null,
    response: sent.response || null,
    sentAt
  });

  return {
    ok: Boolean(sent.ok),
    alertKey,
    mode: "ADMIN_MONITORING_ONLY",
    status: sent.status || null,
    sentAt,
    error: sent.ok ? null : "telegram-send-failed"
  };
}


async function maybeSendStrategyBPremiumUserAlert(env, dbUrl, item) {
  const enabled = String(env.STRATEGY_B_PREMIUM_USER_ALERT_ENABLED ?? "true").toLowerCase() !== "false";
  const controls = await getStrategyControls(dbUrl);

  if (!enabled) return { ok: false, skipped: "strategy-b-premium-user-alert-env-disabled" };
  if (controls.strategyBPremiumUserAlert !== true) return { ok: false, skipped: "strategy-b-premium-user-alert-master-off" };
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, skipped: "telegram-bot-token-missing" };
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };

  const alertKey = item?.id || [item?.pair || "XAUUSD", "STRATEGY_B_PREMIUM", item?.direction || item?.signal || "CALL", item?.candleTime || item?.createdAt || Date.now()].join("|");
  const safeAlertKey = safeKey(alertKey);
  const existingSummary = await fbGet(dbUrl, `/xauusd/strategyB/premiumAlerts/${safeAlertKey}/summary`);
  if (existingSummary?.sent === true || existingSummary?.successCount > 0) {
    return { ok: true, skipped: "duplicate-strategy-b-premium-user-alert", alertKey, totalRecipients: existingSummary.totalRecipients || 0, successCount: existingSummary.successCount || 0 };
  }

  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {}).filter(Boolean);
  const seen = new Set();
  if (env.TELEGRAM_CHAT_ID) seen.add(String(env.TELEGRAM_CHAT_ID)); // admin/global sudah dapat admin alert, jangan dobel lewat jalur premium.

  const recipients = [];
  const skipped = [];

  for (const user of users) {
    const decision = evaluateStrategyBPremiumReceiver(user, seen);
    const base = {
      uid: user?.uid || null,
      email: user?.email || null,
      role: user?.role || "free",
      chatId: maskChatId(user?.telegramChatId || ""),
      reason: decision.reason
    };

    if (decision.ok) {
      recipients.push({
        ...base,
        chatIdRaw: String(user.telegramChatId),
        status: "READY"
      });
      seen.add(String(user.telegramChatId));
    } else {
      skipped.push({ ...base, status: "SKIPPED" });
    }
  }

  if (!recipients.length) {
    await fbPut(dbUrl, `/xauusd/strategyB/premiumAlerts/${safeAlertKey}/summary`, {
      alertKey,
      strategyId: item?.id || null,
      type: "STRATEGY_B_PREMIUM_USER_ALERT",
      sent: false,
      ok: false,
      skipped: "no-eligible-premium-recipients",
      skippedPreview: skipped.slice(0, 20),
      totalRecipients: 0,
      successCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString()
    });
    return { ok: false, skipped: "no-eligible-premium-recipients", alertKey, totalRecipients: 0, successCount: 0 };
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || env.DASHBOARD_URL || "https://www.xauaisignal.online";
  const message = buildStrategyBPremiumTelegramMessage(item, dashboardUrl);
  const results = [];

  for (const recipient of recipients) {
    const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, recipient.chatIdRaw, message, dashboardUrl);
    const log = {
      alertKey,
      strategyId: item?.id || null,
      uid: recipient.uid || null,
      email: recipient.email || null,
      role: recipient.role || null,
      chatId: maskChatId(recipient.chatIdRaw),
      ok: Boolean(sent.ok),
      status: sent.status || null,
      response: sent.response || null,
      sentAt: new Date().toISOString()
    };
    results.push(log);
    await fbPut(dbUrl, `/xauusd/strategyB/premiumAlerts/${safeAlertKey}/deliveries/${safeKey(recipient.chatIdRaw)}`, log);
  }

  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;
  const sentAt = new Date().toISOString();

  await fbPut(dbUrl, `/xauusd/strategyB/premiumAlerts/${safeAlertKey}/summary`, {
    alertKey,
    strategyId: item?.id || null,
    type: "STRATEGY_B_PREMIUM_USER_ALERT",
    mode: "PREMIUM_USER_ALERT_LIVE",
    sent: successCount > 0,
    ok: successCount > 0,
    totalRecipients: results.length,
    successCount,
    failedCount,
    skippedCount: skipped.length,
    skippedPreview: skipped.slice(0, 20),
    sentAt
  });

  return {
    ok: successCount > 0,
    alertKey,
    mode: "PREMIUM_USER_ALERT_LIVE",
    totalRecipients: results.length,
    successCount,
    failedCount,
    sentAt,
    error: successCount > 0 ? null : "all-premium-telegram-send-failed"
  };
}

function evaluateStrategyBPremiumReceiver(user, seenChatIds) {
  if (!user) return { ok: false, reason: "User data kosong" };
  if (user.status && user.status !== "active") return { ok: false, reason: "Akun tidak aktif" };
  if (!isActivePremiumForTelegram(user)) return { ok: false, reason: "Bukan premium/admin aktif" };
  if (!user.telegramConnected || !user.telegramChatId) return { ok: false, reason: "Telegram belum terhubung" };

  const chatId = String(user.telegramChatId || "");
  if (seenChatIds.has(chatId)) return { ok: false, reason: "Chat ID duplikat / sudah menerima jalur admin" };

  if (user.telegramAlertEnabled === false) return { ok: false, reason: "Alert dimatikan user" };
  if (user.telegramAlertMainSignal === false) return { ok: false, reason: "Main Signal Alert OFF" };

  return { ok: true, reason: "Premium/admin aktif, Telegram connected, alert ON" };
}

function buildStrategyBPremiumTelegramMessage(item, dashboardUrl) {
  return buildStrategyBAutoAdminTelegramMessage(item, dashboardUrl)
    .replace("Strategy B · Admin Monitoring Only", "Strategy B · Premium User Alert")
    .replace("Alert ini hanya untuk admin/global monitoring. Belum dikirim ke user premium dan belum menggantikan Strategy A.", "SMC AI premium alert aktif untuk akun yang Telegram connected dan alert ON. Strategy B masih live-backtest, gunakan risk management.");
}

function buildStrategyBAutoAdminTelegramMessage(item, dashboardUrl) {
  const direction = String(item?.direction || item?.signal || "BUY").toUpperCase();
  const isBuy = direction === "BUY";
  const title = isBuy ? "🟢 SMC AI BUY · LIVE BACKTEST" : "🔴 SMC AI SELL · LIVE BACKTEST";
  const stats = item?.statsSnapshot || {};
  const snapshot = item?.smcSnapshot || {};
  const active = snapshot.active || {};
  const obValid = stats.freshOb || Boolean(active.ob) ? "VALID" : "WAIT";
  const sweepValid = stats.sweep || Boolean(active.sweep?.valid) ? "YES" : "WAIT";
  const chochValid = stats.choch || Boolean(active.choch?.valid) ? "YES" : "WAIT";
  const emaValid = stats.ema || Boolean(active.ema) ? "YES" : "WAIT";

  return [
    `<b>${title}</b>`,
    `<i>Strategy B · Admin Monitoring Only</i>`,
    "",
    "SMC AI mendeteksi setup valid dari live-backtest engine.",
    "",
    `<b>Pair:</b> ${escapeHtml(item?.pair || "XAUUSD")}`,
    `<b>Entry:</b> ${formatPrice(item?.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(item?.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(item?.tp)}`,
    `<b>RR:</b> ${escapeHtml(item?.rr || "1:2")}`,
    "",
    "🧠 <b>SMC Checklist</b>",
    `<b>OB M15:</b> ${escapeHtml(obValid)}`,
    `<b>Sweep M1:</b> ${escapeHtml(sweepValid)}`,
    `<b>CHOCH M1:</b> ${escapeHtml(chochValid)}`,
    `<b>EMA M1:</b> ${escapeHtml(emaValid)}`,
    "",
    `<b>Confidence:</b> ${Number(item?.confidence || item?.score || 0)}%`,
    `<b>RSI:</b> ${formatIndicator(stats.rsi)} · <b>MFI:</b> ${formatIndicator(stats.mfi)}`,
    `<b>ATR M1:</b> ${formatIndicator(stats.atr)}`,
    "",
    "📌 <b>Reason</b>",
    escapeHtml(item?.reason || "OB → Sweep → CHOCH → EMA sudah lengkap untuk Strategy B."),
    "",
    "⚠️ <b>Mode</b>",
    "Alert ini hanya untuk admin/global monitoring. Belum dikirim ke user premium dan belum menggantikan Strategy A.",
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`
  ].join("\n");
}

async function trimFirebaseList(dbUrl, path, maxItems = 50) {
  const raw = await fbGet(dbUrl, path);
  const list = Object.values(raw || {})
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const extra = list.slice(maxItems);

  await Promise.all(
    extra.map((item) => {
      if (!item?.id) return null;
      return fbDelete(dbUrl, `${path}/${item.id}`);
    }).filter(Boolean)
  );
}

async function fbDelete(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "DELETE"
  });
  if (!res.ok) return null;
  return await res.json();
}


async function maybeSaveCallHistory(env, dbUrl, signal, market) {
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };

  const isCall = signal.callStage === "CALL" && (signal.signal === "BUY" || signal.signal === "SELL");
  if (!isCall) return { ok: false, skipped: "not-call-signal" };

  const callId = [
    market?.symbol || signal.pair || "XAUUSD",
    signal.signal,
    signal.candleTime || market?.serverTime || market?.receivedAt || Date.now()
  ]
    .join("_")
    .replaceAll(" ", "_")
    .replaceAll(":", "-")
    .replaceAll(".", "-")
    .replaceAll("/", "-");

  const existing = await fbGet(dbUrl, `/xauusd/callHistory/${callId}`);
  if (existing?.id === callId) {
    return { ok: true, skipped: "duplicate-call", callId };
  }

  const payload = {
    id: callId,
    type: "MAIN_M5_LIMIT",
    timeframe: "M5",
    pair: market?.symbol || signal.pair || "XAUUSD",
    signal: signal.signal,
    signalLabel: signal.signalLabel || signal.signal,
    callStage: signal.callStage,
    entry: signal.entry,
    sl: signal.sl,
    originalSl: signal.sl,
    tp: signal.tp,
    tp1: signal.tp1 ?? signal.strategy?.mainM5?.tp1 ?? null,
    tp2: signal.tp2 ?? signal.strategy?.mainM5?.tp2 ?? signal.tp ?? null,
    partialTp: signal.strategy?.mainM5?.partialTp ?? null,
    confidence: signal.confidence,
    probability: signal.strategy?.probability || null,
    reason: signal.reason || "",
    candleTime: signal.candleTime || null,
    serverTime: market?.serverTime || null,
    createdAt: new Date().toISOString(),
    status: "PENDING",
    result: null,
    closedAt: null,
    note: "",
    strategySnapshot: {
      rsi: signal.strategy?.rsi ?? null,
      mfi: signal.strategy?.mfi ?? null,
      ema9: signal.strategy?.ema9 ?? null,
      ema20: signal.strategy?.ema20 ?? null,
      emaCross: signal.strategy?.emaCross ?? null,
      mainM5: signal.strategy?.mainM5 ?? null,
      orderBlock: signal.strategy?.orderBlock ?? null,
      confirmation: signal.strategy?.confirmation ?? null,
      buyScore: signal.strategy?.buyScore ?? null,
      sellScore: signal.strategy?.sellScore ?? null
    },
    maxPending: 4,
    maxBuyPending: 2,
    maxSellPending: 2,
    pendingPolicy: "MAX_2_BUY_2_SELL_EXPIRE_OLD_ON_NEW_STRUCTURE",
    bosKey: signal.strategy?.mainM5?.bosKey || null,
    bosDirection: signal.strategy?.mainM5?.bosDirection || null,
    planKey: [signal.signal, signal.strategy?.mainM5?.bosKey || "NO_BOS", signal.entry, signal.sl, signal.tp].join("_")
  };

  const slotCheck = await expireOldMainPendingSlots(dbUrl, signal.signal, callId, payload);
  if (slotCheck?.allow === false) {
    return { ok: false, skipped: slotCheck.reason || "main-trend-slot-full", callId: null, activeCount: slotCheck.activeCount || 0 };
  }

  await fbPut(dbUrl, `/xauusd/callHistory/${callId}`, payload);

  return { ok: true, callId, slotCheck };
}

async function expireOldMainPendingSlots(dbUrl, signalSide, newId, newPayload = {}) {
  const side = String(signalSide || "").toUpperCase();
  const readActive = async () => {
    const raw = await fbGet(dbUrl, "/xauusd/callHistory");
    return Object.values(raw || {})
      .filter(Boolean)
      .filter((item) => String(item.signal || "").toUpperCase() === side)
      .filter((item) => ["PENDING", "OPEN", "RUNNING"].includes(String(item.status || "PENDING").toUpperCase()))
      .filter((item) => !["WIN", "LOSS", "BE", "EXPIRED"].includes(String(item.result || "").toUpperCase()))
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  };

  const items = await readActive();

  for (const item of items) {
    if (!item?.id || item.id === newId) continue;
    const status = String(item.status || "PENDING").toUpperCase();

    // Yang sudah tersentuh entry / sedang running tidak boleh dihapus otomatis.
    if (status !== "PENDING") continue;

    const oldBosKey = String(item.bosKey || item.strategySnapshot?.mainM5?.bosKey || "");
    const newBosKey = String(newPayload.bosKey || newPayload.strategySnapshot?.mainM5?.bosKey || "");
    const oldPlan = [Number(item.entry || 0), Number(item.sl || 0), Number(item.tp || 0)];
    const newPlan = [Number(newPayload.entry || 0), Number(newPayload.sl || 0), Number(newPayload.tp || 0)];
    const changedBos = Boolean(oldBosKey && newBosKey && oldBosKey !== newBosKey);
    const changedPlanClearly = oldPlan.some((value, index) => Math.abs(value - newPlan[index]) > 0.8);
    const changedStructure = changedBos || changedPlanClearly;

    if (!changedStructure) continue;

    await fbPut(dbUrl, `/xauusd/callHistory/${item.id}`, {
      ...item,
      status: "CLOSED",
      result: "EXPIRED",
      closedAt: new Date().toISOString(),
      note: changedBos
        ? "Expired otomatis karena muncul BOS / struktur M5 baru sebelum pending sebelumnya tersentuh."
        : "Expired otomatis karena rencana limit M5 baru sudah lebih relevan dari pending sebelumnya."
    });
  }

  let active = await readActive();
  const pending = active.filter((item) => String(item.status || "PENDING").toUpperCase() === "PENDING");

  // Maksimal 2 plan aktif per arah trend. Jika slot penuh, hapus pending tertua saja.
  while (active.length >= 2 && pending.length > 0) {
    const oldestPending = pending.shift();
    if (!oldestPending?.id || oldestPending.id === newId) continue;
    await fbPut(dbUrl, `/xauusd/callHistory/${oldestPending.id}`, {
      ...oldestPending,
      status: "CLOSED",
      result: "EXPIRED",
      closedAt: new Date().toISOString(),
      note: "Expired otomatis karena slot trend sudah penuh. Maksimal 2 plan aktif per arah EMA."
    });
    active = await readActive();
  }

  active = await readActive();
  if (active.length >= 2) {
    return {
      allow: false,
      reason: "max-2-active-main-trend-slots",
      activeCount: active.length,
      note: "Sinyal baru ditahan karena sudah ada 2 posisi/plan aktif pada arah EMA yang sama."
    };
  }

  return { allow: true, activeCount: active.length };
}

function buildProbability(signalLabel, callStage, buyScore, sellScore, flags = {}) {
  const dominantScore = Math.max(Number(buyScore || 0), Number(sellScore || 0));
  const raw = Math.min(100, Math.max(0, dominantScore));

  let label = "LOW";
  if (raw >= 80) label = "HIGH";
  else if (raw >= 65) label = "MEDIUM";

  const checklist = [
    flags.rsiBuyOk || flags.rsiSellOk ? "RSI cocok" : "RSI belum cocok",
    flags.mfiBuyOk || flags.mfiSellOk ? "MFI cocok" : "MFI belum cocok",
    flags.bullishCrossNow || flags.bearishCrossNow ? "EMA cross valid" : flags.readyBuy || flags.readySell ? "EMA ready" : "EMA belum trigger",
    flags.obBuyOk || flags.obSellOk ? "OB M15 cocok" : "OB M15 belum cocok"
  ];

  return {
    score: Math.round(raw),
    label,
    callQuality: callStage === "CALL" ? "VALID_CALL" : callStage === "READY" ? "READY_ONLY" : "WAIT",
    checklist,
    note: `${signalLabel || "WAIT"} probability ${Math.round(raw)}% (${label})`
  };
}



async function getStrategyControls(dbUrl) {
  const defaults = {
    mainSignalAlert: true,
    mainSignalResultAlert: true,
    m1ScalpTracking: true,
    m1ScalpResultTracking: true,
    strategyBLiveBacktest: true,
    strategyBAdminAlert: true,
    strategyBResultAdminAlert: true,
    strategyBPremiumUserAlert: false
  };
  if (!dbUrl) return defaults;
  const raw = await fbGet(dbUrl, "/xauusd/settings/strategyControls");
  return { ...defaults, ...(raw || {}) };
}

async function maybeSendTelegramAlert(env, dbUrl, signal, market) {
  const enabled = String(env.TELEGRAM_ALERT_ENABLED || "true").toLowerCase() !== "false";
  const readyEnabled = String(env.TELEGRAM_READY_ALERT_ENABLED || "false").toLowerCase() === "true";
  const controls = await getStrategyControls(dbUrl);

  if (!enabled) return { ok: false, skipped: "telegram-disabled" };
  if (controls.mainSignalAlert === false) return { ok: false, skipped: "main-signal-alert-master-off" };
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, skipped: "telegram-bot-token-missing" };
  if (!dbUrl) return { ok: false, skipped: "firebase-env-missing" };

  const isCall = signal.callStage === "CALL" && (signal.signal === "BUY" || signal.signal === "SELL");
  const isReady = readyEnabled && signal.callStage === "READY" && (signal.signal === "READY_BUY" || signal.signal === "READY_SELL");

  if (!isCall && !isReady) return { ok: false, skipped: "not-call-signal" };

  const alertKey = [
    signal.pair || "XAUUSD",
    signal.signal,
    signal.callStage,
    signal.candleTime || market?.serverTime || market?.receivedAt || "no-time"
  ].join("|");

  const duplicateKey = buildMainSignalDuplicateKey(signal, market);
  const duplicateLockPath = `/xauusd/telegram/alertLocks/${safeKey(duplicateKey)}`;
  const duplicateWindowMs = Number(env.TELEGRAM_ALERT_DEDUP_WINDOW_SEC || 900) * 1000;
  const nowMs = Date.now();

  const lastAlert = await fbGet(dbUrl, "/xauusd/telegram/lastAlert");
  const lock = await fbGet(dbUrl, duplicateLockPath);

  if (lastAlert?.alertKey === alertKey) {
    return { ok: true, skipped: "duplicate-alert", alertKey, duplicateKey };
  }

  if (lock?.sentAtMs && nowMs - Number(lock.sentAtMs) <= duplicateWindowMs) {
    return { ok: true, skipped: "duplicate-main-signal-lock", alertKey, duplicateKey };
  }

  // Lock sebelum kirim agar kalau /api/signal kepanggil beberapa kali cepat, Telegram tidak spam.
  await fbPut(dbUrl, duplicateLockPath, {
    duplicateKey,
    alertKey,
    signal: signal.signal,
    callStage: signal.callStage,
    entry: signal.entry ?? null,
    sl: signal.sl ?? null,
    tp: signal.tp ?? null,
    sentAtMs: nowMs,
    lockedAt: new Date(nowMs).toISOString(),
    ttlSec: Math.round(duplicateWindowMs / 1000)
  });

  const message = buildTelegramMessage(signal, market);
  const recipients = await getTelegramAlertRecipients(env, dbUrl);
  const results = [];

  if (!recipients.length) {
    return {
      ok: false,
      skipped: "no-telegram-recipients",
      alertKey
    };
  }

  for (const recipient of recipients) {
    const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, recipient.chatId, message, env.DASHBOARD_URL);

    results.push({
      uid: recipient.uid || null,
      email: recipient.email || null,
      source: recipient.source,
      chatId: maskChatId(recipient.chatId),
      ok: sent.ok,
      status: sent.status
    });

    await fbPut(dbUrl, `/xauusd/telegram/deliveryLogs/${safeKey(alertKey)}/${safeKey(recipient.chatId)}`, {
      alertKey,
      signal: signal.signal,
      callStage: signal.callStage,
      uid: recipient.uid || null,
      email: recipient.email || null,
      source: recipient.source,
      chatId: maskChatId(recipient.chatId),
      ok: sent.ok,
      status: sent.status,
      response: sent.response || null,
      sentAt: new Date().toISOString()
    });
  }

  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;

  if (successCount > 0) {
    await fbPut(dbUrl, "/xauusd/telegram/lastAlert", {
      alertKey,
      signal: signal.signal,
      callStage: signal.callStage,
      candleTime: signal.candleTime || null,
      totalRecipients: results.length,
      successCount,
      failedCount,
      sentAt: new Date().toISOString()
    });
  }

  return {
    ok: successCount > 0,
    alertKey,
    mode: "multi-user-premium-alert",
    totalRecipients: results.length,
    successCount,
    failedCount,
    recipients: results
  };
}

function buildMainSignalDuplicateKey(signal, market) {
  const pair = String(signal?.pair || market?.symbol || "XAUUSD").toUpperCase();
  const direction = String(signal?.signal || "WAIT").toUpperCase();
  const entry = roundForAlertKey(signal?.entry ?? market?.bid ?? market?.lastClose ?? 0);
  const sl = roundForAlertKey(signal?.sl ?? 0);
  const tp = roundForAlertKey(signal?.tp ?? 0);
  return ["MAIN_SIGNAL", pair, direction, entry, sl, tp].join("|");
}

function roundForAlertKey(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "NA";
  return (Math.round(n * 10) / 10).toFixed(1);
}

async function getTelegramAlertRecipients(env, dbUrl) {
  const recipients = [];
  const seen = new Set();

  // Chat utama lama tetap dipakai supaya alert ke admin/channel lama tidak hilang.
  if (env.TELEGRAM_CHAT_ID) {
    const chatId = String(env.TELEGRAM_CHAT_ID);
    recipients.push({
      source: "default-env-chat",
      uid: null,
      email: "default",
      chatId
    });
    seen.add(chatId);
  }

  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {}).filter(Boolean);

  for (const user of users) {
    if (!isActivePremiumForTelegram(user)) continue;
    if (!user.telegramConnected || !user.telegramChatId) continue;

    const chatId = String(user.telegramChatId);

    if (seen.has(chatId)) continue;

    recipients.push({
      source: "premium-user",
      uid: user.uid || null,
      email: user.email || null,
      chatId
    });

    seen.add(chatId);
  }

  return recipients;
}

function isActivePremiumForTelegram(user) {
  if (!user) return false;
  if (user.status && user.status !== "active") return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;

  const until = user.premiumUntil || user.expiredAt || null;
  if (!until) return false;

  return new Date(until).getTime() > Date.now();
}

function safeKey(value) {
  return String(value || "empty")
    .replaceAll(".", "_")
    .replaceAll("#", "_")
    .replaceAll("$", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_")
    .replaceAll("/", "_")
    .replaceAll("|", "_");
}

function maskChatId(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}


function buildTelegramMessage(signal, market) {
  const s = signal.strategy || {};
  const c = s.confirmation || {};
  const signalCode = String(signal.signal || "WAIT").toUpperCase();
  const isBuy = signalCode.includes("BUY");
  const isSell = signalCode.includes("SELL");
  const isCall = signal.callStage === "CALL";
  const isReady = signal.callStage === "READY";
  const direction = isBuy ? "BUY" : isSell ? "SELL" : "WAIT";
  const pair = market?.symbol || signal.pair || "XAUUSD";
  const confidence = Number(signal.confidence || 0);

  const rawBullOb = s.orderBlock?.bullish;
  const rawBearOb = s.orderBlock?.bearish;
  const obBull = getFreshObForDisplay(rawBullOb);
  const obBear = getFreshObForDisplay(rawBearOb);
  const obText = isBuy
    ? formatOb(obBull)
    : isSell
      ? formatOb(obBear)
      : `Bull ${formatOb(obBull)} | Bear ${formatOb(obBear)}`;

  const header = buildTelegramSignalHeader({ isCall, isReady, direction });
  const action = buildTelegramAction({ isCall, isReady, direction });
  const reasonLines = buildTelegramReasonLines(signal, s, c, obText);
  const quality = buildTelegramQuality(confidence, signal.callStage);
  const entry = formatPrice(signal.entry);
  const sl = formatPrice(signal.sl);
  const tp = formatPrice(signal.tp);
  const lastPrice = formatPrice(market?.bid || market?.lastPrice || market?.close || signal.entry);
  const candleTime = signal.candleTime || market?.serverTime || market?.receivedAt || "-";
  const dashboardUrl = "https://www.xauaisignal.online";

  const setupSnapshot = s.mainM5?.mode === "M5_EMA_PULLBACK_LIMIT_MAIN"
    ? [
        `EMA 9/20 M5 ${formatIndicator(s.mainM5.ema9)} / ${formatIndicator(s.mainM5.ema20)}`,
        `Plan: ${escapeHtml(s.mainM5.label || signal.signalLabel || "WAIT")} · RR ${escapeHtml(s.mainM5.rr || "1:1")}`,
        `Source: ${escapeHtml(s.mainM5.sourceTimeframe || "M5")}`
      ]
    : [
        `RSI ${formatIndicator(s.rsi)} · MFI ${formatIndicator(s.mfi)}`,
        `EMA 9/20 ${formatIndicator(s.ema9)} / ${formatIndicator(s.ema20)}`,
        `OB M15: ${escapeHtml(obText)}`
      ];

  return [
    `${header.emoji} <b>${header.title}</b>`,
    `<i>${header.subtitle}</i>`,
    "",
    `<b>Signal:</b> ${escapeHtml(direction)}`,
    `<b>Pair:</b> ${escapeHtml(pair)}`,
    `<b>Confidence:</b> ${confidence}% · ${escapeHtml(quality)}`,
    `<b>Last Price:</b> ${escapeHtml(lastPrice)}`,
    "",
    `📍 <b>Trade Plan</b>`,
    `<b>Entry Area:</b> ${escapeHtml(entry)}`,
    `<b>Stop Loss:</b> ${escapeHtml(sl)}`,
    `<b>Take Profit:</b> ${escapeHtml(tp)}`,
    "",
    `🧠 <b>Market Reason</b>`,
    ...reasonLines,
    "",
    `✅ <b>Setup Snapshot</b>`,
    ...setupSnapshot,
    "",
    `🎯 <b>Action</b>`,
    escapeHtml(action),
    "",
    `🕒 <b>Market Time:</b> ${escapeHtml(candleTime)}`,
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    `<i>Bukan financial advice. Demo first, risk management wajib.</i>`
  ].join("\n");
}

function buildTelegramSignalHeader({ isCall, isReady, direction }) {
  if (isCall && direction === "BUY") {
    return {
      emoji: "🟢",
      title: "XAU AI CALL · BUY",
      subtitle: "Setup utama sudah valid berdasarkan engine premium."
    };
  }

  if (isCall && direction === "SELL") {
    return {
      emoji: "🔴",
      title: "XAU AI CALL · SELL",
      subtitle: "Setup utama sudah valid berdasarkan engine premium."
    };
  }

  if (isReady) {
    return {
      emoji: "🟡",
      title: `XAU AI READY · ${direction}`,
      subtitle: "Setup mulai terbentuk, tunggu konfirmasi final."
    };
  }

  return {
    emoji: "⚪",
    title: "XAU AI MONITOR",
    subtitle: "Belum ada setup utama yang valid."
  };
}

function buildTelegramAction({ isCall, isReady, direction }) {
  if (isCall) {
    return `${direction} valid. Tetap pakai risk management, lot kecil dulu, dan pastikan spread aman sebelum entry.`;
  }

  if (isReady) {
    return `Setup ${direction} mulai siap. Tunggu candle konfirmasi sebelum entry.`;
  }

  return "Tunggu setup berikutnya. Jangan entry saat konfirmasi belum lengkap.";
}

function buildTelegramQuality(confidence, callStage) {
  if (callStage === "CALL" && confidence >= 80) return "Premium High Conviction";
  if (callStage === "CALL") return "Premium Valid Setup";
  if (callStage === "READY") return "Setup Forming";
  if (confidence >= 65) return "Watchlist";
  return "Monitoring";
}

function buildTelegramReasonLines(signal, s, c, obText) {
  const lines = [];
  const m = s.mainM5 || null;
  if (m?.mode === "M5_EMA_PULLBACK_LIMIT_MAIN") {
    lines.push(`• Strategi utama: EMA 9/20 M5 valid lalu tunggu engulfing di area EMA 9/20.`);
    lines.push(`• Rencana: ${escapeHtml(m.label || signal.signalLabel || "WAIT")}.`);
    if (m.cross?.type && m.cross.type !== "NONE") lines.push(`• EMA break: ${escapeHtml(m.cross.type)} pada M5.`);
    if (m.correction?.touchedEma9) lines.push(`• Engulfing sudah muncul di area EMA 9/20.`);
    if (signal.reason) lines.push(`• Catatan AI: ${escapeHtml(String(signal.reason).replace(/\s+/g, " ").trim())}`);
    return lines.slice(0, 5);
  }

  const emaStatus = humanize(s.emaCross || "WAIT");

  if (s.emaCross) lines.push(`• EMA membaca: ${escapeHtml(emaStatus)}.`);

  if (c.rsiBuyOk || c.rsiSellOk) {
    lines.push(`• RSI ${formatIndicator(s.rsi)} sudah mendukung arah setup.`);
  } else {
    lines.push(`• RSI ${formatIndicator(s.rsi)} belum jadi konfirmasi utama.`);
  }

  if (c.mfiBuyOk || c.mfiSellOk) {
    lines.push(`• MFI ${formatIndicator(s.mfi)} menunjukkan aliran market mulai searah.`);
  } else {
    lines.push(`• MFI ${formatIndicator(s.mfi)} masih perlu konfirmasi tambahan.`);
  }

  if (c.obBuyOk || c.obSellOk) {
    lines.push(`• Area OB M15 masih relevan: ${escapeHtml(obText)}.`);
  } else {
    lines.push("• Area OB M15 belum menjadi area eksekusi utama.");
  }

  if (signal.reason) {
    const cleanReason = String(signal.reason).replace(/\s+/g, " ").trim();
    if (cleanReason) lines.push(`• Catatan AI: ${escapeHtml(cleanReason)}`);
  }

  return lines.slice(0, 5);
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return n.toFixed(2);
}

function formatIndicator(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

async function sendTelegram(botToken, chatId, text, dashboardUrl = "") {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: dashboardUrl ? {
        inline_keyboard: [[
          { text: "🚀 Open Premium Dashboard", web_app: { url: dashboardUrl } }
        ]]
      } : undefined
    })
  });

  let response = null;
  try { response = await res.json(); } catch { response = await res.text(); }

  return { ok: res.ok, status: res.status, response };
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) return null;
  return await res.json();
}

async function fbPut(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) return null;
  return await res.json();
}

function emptyStrategy() {
  return {
    trendBias: "Netral",
    rsi: null,
    mfi: null,
    ema9: null,
    ema20: null,
    emaGap: null,
    emaGapThreshold: null,
    emaGapClosing: false,
    emaCross: "WAIT",
    confirmation: {},
    crossAlert: {
      status: "WAITING_DATA",
      message: "Menunggu data candle.",
      readyBuy: false,
      readySell: false,
      bullishCrossNow: false,
      bearishCrossNow: false
    },
    obTimeframe: "M5_ONLY",
    smc: null,
    orderBlock: { bullish: null, bearish: null },
    buyScore: 0,
    sellScore: 0,
    score: 0
  };
}

function buildCrossMessage(signal, emaCross) {
  if (signal === "BUY") return "BUY LIMIT aktif: bullish engulfing M5 sudah close di area EMA 9/20, entry di open engulfing.";
  if (signal === "SELL") return "SELL LIMIT aktif: bearish engulfing M5 sudah close di area EMA 9/20, entry di open engulfing.";
  if (signal === "READY_BUY") return "EMA 9 M5 sudah di atas EMA 20. Menunggu bullish engulfing close di area EMA 9/20 untuk BUY LIMIT.";
  if (signal === "READY_SELL") return "EMA 9 M5 sudah di bawah EMA 20. Menunggu bearish engulfing close di area EMA 9/20 untuk SELL LIMIT.";
  return `Belum ada limit utama valid. Status EMA: ${emaCross}`;
}

function clean(candles) {
  return (candles || [])
    .map((c, index) => ({
      index,
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0)
    }))
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));
}


function detectSmcOrderBlockV2(candles) {
  const data = candles.slice(-180);
  const atr14 = atr(data, 14);

  const swings = detectSwings(data, 2);
  const bosEvents = detectBosEvents(data, swings, atr14);

  let bullish = null;
  let bearish = null;

  // Method 1: SMC BOS klasik.
  for (const bos of bosEvents) {
    if (bos.type === "BULLISH_BOS") {
      const origin = findOriginCandle(data, bos.index, "bullish");
      if (origin) bullish = buildObZone(data, bos, origin, "bullish", atr14, "SMC_BOS");
    }

    if (bos.type === "BEARISH_BOS") {
      const origin = findOriginCandle(data, bos.index, "bearish");
      if (origin) bearish = buildObZone(data, bos, origin, "bearish", atr14, "SMC_BOS");
    }
  }

  // Method 2: visual impulse breakout OB.
  // Ini menangkap kasus seperti screenshot:
  // candle terakhir sebelum impulse naik/turun yang break resistance/support terdekat.
  const impulseOb = detectImpulseBreakoutOrderBlock(data, atr14);

  if (impulseOb?.bullish) {
    if (!bullish || timeToNum(impulseOb.bullish.bosTime) >= timeToNum(bullish.bosTime || bullish.originTime)) {
      bullish = impulseOb.bullish;
    }
  }

  if (impulseOb?.bearish) {
    if (!bearish || timeToNum(impulseOb.bearish.bosTime) >= timeToNum(bearish.bosTime || bearish.originTime)) {
      bearish = impulseOb.bearish;
    }
  }

  bullish = bullish ? updateObStatus(data, bullish, "bullish", atr14) : null;
  bearish = bearish ? updateObStatus(data, bearish, "bearish", atr14) : null;

  return {
    version: "SMC_OB_V3_IMPULSE_BREAKOUT",
    timeframe: "M15",
    swingLookback: 2,
    bosCount: bosEvents.length,
    lastBos: bosEvents[bosEvents.length - 1] || impulseOb?.lastBreakout || null,
    bullish,
    bearish
  };
}

function detectImpulseBreakoutOrderBlock(data, atr14) {
  let bullish = null;
  let bearish = null;
  let lastBreakout = null;

  // Mulai dari candle ke-25 supaya ada cukup resistance/support history.
  for (let i = 25; i < data.length; i++) {
    const c = data[i];
    const prevWindow = data.slice(Math.max(0, i - 20), i);
    if (prevWindow.length < 10) continue;

    const recentHigh = Math.max(...prevWindow.map((x) => x.high));
    const recentLow = Math.min(...prevWindow.map((x) => x.low));
    const body = Math.abs(c.close - c.open);
    const range = Math.max(0.01, c.high - c.low);

    const isStrongBull = c.close > c.open && body >= atr14 * 0.35 && body / range >= 0.45;
    const isStrongBear = c.close < c.open && body >= atr14 * 0.35 && body / range >= 0.45;

    const bullishBreak = isStrongBull && c.close > recentHigh + atr14 * 0.03;
    const bearishBreak = isStrongBear && c.close < recentLow - atr14 * 0.03;

    if (bullishBreak) {
      const origin = findLastOppositeOrigin(data, i, "bullish", atr14);
      if (origin) {
        const bos = {
          type: "BULLISH_BREAKOUT",
          index: i,
          time: c.time,
          breakPrice: round(recentHigh),
          close: round(c.close),
          brokenSwingTime: null
        };
        bullish = buildObZone(data, bos, origin, "bullish", atr14, "IMPULSE_BREAKOUT");
        lastBreakout = bos;
      }
    }

    if (bearishBreak) {
      const origin = findLastOppositeOrigin(data, i, "bearish", atr14);
      if (origin) {
        const bos = {
          type: "BEARISH_BREAKOUT",
          index: i,
          time: c.time,
          breakPrice: round(recentLow),
          close: round(c.close),
          brokenSwingTime: null
        };
        bearish = buildObZone(data, bos, origin, "bearish", atr14, "IMPULSE_BREAKOUT");
        lastBreakout = bos;
      }
    }
  }

  return { bullish, bearish, lastBreakout };
}

function findLastOppositeOrigin(data, breakIndex, direction, atr14) {
  const start = Math.max(0, breakIndex - 16);
  const end = breakIndex - 1;
  let best = null;

  for (let i = end; i >= start; i--) {
    const c = data[i];
    const body = Math.abs(c.close - c.open);
    const range = Math.max(0.01, c.high - c.low);
    const bodyRatio = body / range;

    // Bullish OB = candle bearish terakhir sebelum impulse bullish.
    if (direction === "bullish" && c.close < c.open) {
      best = { ...c, bodyRatio: round(bodyRatio), originIndex: i };
      break;
    }

    // Bearish OB = candle bullish terakhir sebelum impulse bearish.
    if (direction === "bearish" && c.close > c.open) {
      best = { ...c, bodyRatio: round(bodyRatio), originIndex: i };
      break;
    }
  }

  // Fallback kalau tidak ada candle opposite yang jelas:
  // ambil candle kecil sebelum impulse sebagai base.
  if (!best) {
    for (let i = end; i >= start; i--) {
      const c = data[i];
      const range = Math.max(0.01, c.high - c.low);
      const body = Math.abs(c.close - c.open);
      if (body <= atr14 * 0.45 || body / range <= 0.45) {
        best = { ...c, bodyRatio: round(body / range), originIndex: i };
        break;
      }
    }
  }

  return best;
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

  for (let i = end; i >= start; i--) {
    const c = data[i];
    const body = Math.abs(c.close - c.open);
    const range = Math.max(0.01, c.high - c.low);
    const bodyRatio = body / range;

    if (direction === "bullish" && c.close < c.open) {
      return { ...c, bodyRatio: round(bodyRatio), originIndex: i };
    }

    if (direction === "bearish" && c.close > c.open) {
      return { ...c, bodyRatio: round(bodyRatio), originIndex: i };
    }
  }

  return null;
}

function buildObZone(data, bos, origin, direction, atr14, method = "SMC_BOS") {
  const displacement = Math.abs(data[bos.index].close - origin.close);
  const displacementAtr = displacement / Math.max(0.01, atr14);
  const strength = Math.min(95, Math.max(45, 45 + displacementAtr * 14 + origin.bodyRatio * 20));

  return {
    type: direction === "bullish" ? "Bullish OB M15" : "Bearish OB M15",
    direction,
    timeframe: "M15",
    method,
    low: round(origin.low),
    high: round(origin.high),
    originTime: origin.time,
    bosTime: bos.time,
    bosType: bos.type,
    breakPrice: bos.breakPrice,
    status: "active",
    mitigated: false,
    invalidated: false,
    fresh: true,
    strength: round(strength),
    reason: `${bos.type} M15 ${method} setelah origin candle ${direction === "bullish" ? "bearish/base" : "bullish/base"}`
  };
}

function updateObStatus(data, ob, direction, atr14) {
  let status = "active";
  let touched = false;
  let invalidated = false;
  let touchedTime = null;
  let invalidatedTime = null;

  const low = Number(ob.low);
  const high = Number(ob.high);
  const zoneSize = Math.max(0.01, high - low);
  const mid = (low + high) / 2;

  // Step 10AM4: OB M15 tidak hilang hanya karena sekali disentuh.
  // OB tetap tampil sebagai valid zone sampai benar-benar dibreak jauh.
  const invalidBreakBuffer = Math.max(atr14 * 0.35, zoneSize * 0.25);

  const afterBos = data.filter((c) => timeToNum(c.time) > timeToNum(ob.bosTime));

  for (const c of afterBos) {
    if (direction === "bullish") {
      const touchedOb = c.low <= high && c.high >= low;
      const retracedToHalfOb = c.low <= mid;

      if (touchedOb || retracedToHalfOb) {
        touched = true;
        touchedTime = touchedTime || c.time;
      }

      if (c.close < low - invalidBreakBuffer) {
        invalidated = true;
        invalidatedTime = c.time;
        break;
      }
    }

    if (direction === "bearish") {
      const touchedOb = c.high >= low && c.low <= high;
      const retracedToHalfOb = c.high >= mid;

      if (touchedOb || retracedToHalfOb) {
        touched = true;
        touchedTime = touchedTime || c.time;
      }

      if (c.close > high + invalidBreakBuffer) {
        invalidated = true;
        invalidatedTime = c.time;
        break;
      }
    }
  }

  if (invalidated) status = "invalid";
  else status = "active";

  return {
    ...ob,
    status,
    touched,
    touchedTime,
    // Backward-compatible fields: existing UI may still read mitigated.
    mitigated: touched,
    mitigatedTime: touchedTime,
    invalidated,
    invalidatedTime,
    fresh: !invalidated,
    invalidBreakBuffer: round(invalidBreakBuffer),
    mitigationRule: "persistent_ob_until_deep_break"
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

function mfi(candles, period = 14) {
  if (candles.length <= period) return 50;

  let positiveFlow = 0;
  let negativeFlow = 0;
  const slice = candles.slice(-period - 1);

  for (let i = 1; i < slice.length; i++) {
    const current = slice[i];
    const previous = slice[i - 1];

    const currentTp = (current.high + current.low + current.close) / 3;
    const previousTp = (previous.high + previous.low + previous.close) / 3;
    const moneyFlow = currentTp * Math.max(1, current.volume || 1);

    if (currentTp > previousTp) positiveFlow += moneyFlow;
    else if (currentTp < previousTp) negativeFlow += moneyFlow;
  }

  if (negativeFlow === 0 && positiveFlow === 0) return 50;
  if (negativeFlow === 0) return 100;

  const moneyRatio = positiveFlow / negativeFlow;
  return 100 - 100 / (1 + moneyRatio);
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

function humanize(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

function getFreshObForDisplay(ob) {
  if (!ob) return null;
  if (ob.invalidated || ob.status === "invalid") return null;
  // Step 10AM4: OB M15 tetap ditampilkan walaupun sudah pernah disentuh.
  // Hilang hanya saat invalid/deep break atau ketika engine menemukan OB baru yang lebih relevan.
  if (ob.status && ob.status !== "active" && ob.status !== "mitigated") return null;
  return ob;
}

function formatOb(ob) {
  if (!ob) return "tidak ada fresh OB";
  const method = ob.method ? `, ${ob.method}` : "";
  return `${ob.low}-${ob.high} (${ob.status}${method}, strength ${ob.strength}%)`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
