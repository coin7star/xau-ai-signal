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

  const telegram = await maybeSendTelegramAlert(env, dbUrl, signal, market);
  const callHistory = await maybeSaveCallHistory(env, dbUrl, signal, market);
  const scalpHistory = await maybeSaveScalpHistory(env, dbUrl, signal, market);

  return json({
    ...signal,
    telegram,
    callHistory,
    scalpHistory
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

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (bullishCrossNow) { buyScore += 34; reasons.push("EMA 9 sudah cross ke atas EMA 20."); }
  if (bearishCrossNow) { sellScore += 34; reasons.push("EMA 9 sudah cross ke bawah EMA 20."); }

  if (readyBuy) { buyScore += 18; reasons.push("EMA 9 mendekati bullish cross. Siap-siap BUY, tunggu cross."); }
  if (readySell) { sellScore += 18; reasons.push("EMA 9 mendekati bearish cross. Siap-siap SELL, tunggu cross."); }

  if (rsiBuyOk) { buyScore += 16; reasons.push(`RSI ${round(rsi14)} cocok untuk BUY.`); }
  if (rsiSellOk) { sellScore += 16; reasons.push(`RSI ${round(rsi14)} cocok untuk SELL.`); }

  if (mfiBuyOk) { buyScore += 16; reasons.push(`MFI ${round(mfi14)} mendukung arus beli.`); }
  if (mfiSellOk) { sellScore += 16; reasons.push(`MFI ${round(mfi14)} mendukung arus jual.`); }

  if (obBuyOk) { buyScore += 18; reasons.push(`Harga dekat Bullish OB M15 (${bullOb.status}).`); }
  if (obSellOk) { sellScore += 18; reasons.push(`Harga dekat Bearish OB M15 (${bearOb.status}).`); }

  if (smc?.lastBos?.type === "BULLISH_BOS") buyScore += 8;
  if (smc?.lastBos?.type === "BEARISH_BOS") sellScore += 8;

  let finalSignal = "WAIT";
  let callStage = "WAIT";
  let signalLabel = "WAIT";

  const buyAllMatch = bullishCrossNow && rsiBuyOk && mfiBuyOk && obBuyOk;
  const sellAllMatch = bearishCrossNow && rsiSellOk && mfiSellOk && obSellOk;
  const readyBuyAllMatch = readyBuy && rsiBuyOk && mfiBuyOk && obBuyOk;
  const readySellAllMatch = readySell && rsiSellOk && mfiSellOk && obSellOk;

  const signalQualityGuard = buildSignalQualityGuardV2({
    market,
    m1,
    m15,
    close,
    atr14,
    confidence: 0,
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
    m15Ready: m15.length >= 50
  });

  if (readyBuyAllMatch) {
    finalSignal = "READY_BUY";
    callStage = "READY";
    signalLabel = "SIAP-SIAP BUY";
  } else if (readySellAllMatch) {
    finalSignal = "READY_SELL";
    callStage = "READY";
    signalLabel = "SIAP-SIAP SELL";
  }

  if (buyAllMatch) {
    finalSignal = "BUY";
    callStage = "CALL";
    signalLabel = "BUY";
  } else if (sellAllMatch) {
    finalSignal = "SELL";
    callStage = "CALL";
    signalLabel = "SELL";
  }

  if (finalSignal === "WAIT") {
    reasons.push("Belum call karena RSI + MFI + EMA 9/20 + area OB M15 belum cocok semua.");
  }

  const score = Math.max(buyScore, sellScore);
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
    ? Math.min(82, Math.max(58, Math.round(score)))
    : callStage === "CALL"
      ? Math.min(95, Math.max(68, Math.round(score)))
      : Math.min(60, Math.max(45, Math.round(score)));

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
    m15Ready: m15.length >= 50
  });

  if (callStage === "CALL" && !finalQualityGuard.allowCall) {
    finalSignal = "WAIT";
    callStage = "WAIT";
    signalLabel = "WAIT";
    reasons.push(`Signal Quality Guard menahan CALL: ${finalQualityGuard.blockers[0] || "market belum ideal"}.`);
  }

  const trendBias = ema9 > ema20 ? "Bullish" : ema9 < ema20 ? "Bearish" : "Netral";
  const scalping = buildM1ScalpingStrategy(m1, closes, {
    ema9,
    ema20,
    rsi14,
    mfi14,
    atr14,
    close
  });

  if (m15.length < 50) {
    reasons.push("OB M15 belum aktif karena data M15 belum cukup. Pastikan EA terbaru sudah dipasang.");
  }

  const humanReason = buildHumanSignalReason({
    finalSignal,
    signalLabel,
    callStage,
    confidence,
    close,
    ema9,
    ema20,
    gap,
    gapThreshold,
    gapClosing,
    emaCross,
    rsi14,
    mfi14,
    atr14,
    bullOb,
    bearOb,
    bullObStatus: bullOb?.status || "none",
    bearObStatus: bearOb?.status || "none",
    m15Ready: m15.length >= 50,
    buyScore,
    sellScore,
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
    qualityGuard: finalQualityGuard,
    legacyReasons: reasons
  });

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    signalLabel,
    callStage,
    candleTime: last.time || null,
    entry: round(close),
    sl: round(sl),
    tp: round(tp),
    confidence,
    reason: humanReason.summary,
    reasonDetails: humanReason,
    qualityGuard: finalQualityGuard,
    mode: "firebase-mt5-data",
    strategy: {
      trendBias,
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
      obTimeframe: "M15",
      smc,
      orderBlock: { bullish: bullOb, bearish: bearOb },
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score),
      scalping,
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
  const dataPassed = candleCount >= 50 && m15Count >= 50;
  const volatilityPassed = atr14 <= atrRiskLimit && candleRange <= candleRiskLimit;
  const confidencePassed = confidence >= 68;
  const obPassed = Boolean(ctx.obBuyOk || ctx.obSellOk || ctx.readyBuyAllMatch || ctx.readySellAllMatch || ctx.buyAllMatch || ctx.sellAllMatch);
  const setupPassed = Boolean(ctx.buyAllMatch || ctx.sellAllMatch || ctx.readyBuyAllMatch || ctx.readySellAllMatch);

  checks.push(makeGuardCheck("Live Feed", feedPassed ? "PASS" : "WAIT", feedPassed ? "Data market masih layak dipakai." : "Live feed MT5/VPS belum fresh."));
  checks.push(makeGuardCheck("Spread", spreadPassed ? "PASS" : "WAIT", spread === null ? "Spread belum terbaca, guard tetap hati-hati." : `Spread ${round(spread)} / batas ${round(maxSpread)}.`));
  checks.push(makeGuardCheck("Data", dataPassed ? "PASS" : "WAIT", `M1 ${candleCount} candle · M15 ${m15Count} candle.`));
  checks.push(makeGuardCheck("Volatility", volatilityPassed ? "PASS" : "WAIT", atr14 ? `ATR ${round(atr14)} masih dalam batas aman.` : "ATR belum terbaca."));
  checks.push(makeGuardCheck("Confidence", confidencePassed ? "PASS" : "WAIT", `Confidence ${confidence || 0}% · minimal 68% untuk CALL.`));
  checks.push(makeGuardCheck("Setup", setupPassed ? "PASS" : "WAIT", setupPassed ? "Kombinasi EMA/RSI/MFI/OB mulai cocok." : "Setup utama belum lengkap."));
  checks.push(makeGuardCheck("OB M15", obPassed ? "PASS" : "WAIT", obPassed ? "Filter OB M15 mendukung setup." : "Harga belum dekat OB M15 valid."));

  if (!feedPassed) blockers.push("live feed MT5/VPS belum fresh");
  if (!spreadPassed) blockers.push("spread belum aman");
  if (!dataPassed) blockers.push("data candle M1/M15 belum cukup");
  if (!volatilityPassed) blockers.push("volatilitas candle/ATR terlalu tinggi");
  if (!confidencePassed) blockers.push("confidence belum cukup untuk CALL");
  if (!setupPassed) blockers.push("kombinasi EMA/RSI/MFI/OB belum lengkap");
  if (!obPassed) blockers.push("OB M15 belum mendukung");

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
  const structure = buildM1StructureEngulfingEmaScalp(candles, closes, context);

  return {
    ...structure,
    activeRule: "M1_SR_ENGULFING_EMA_9_20_FILTER",
    mode: "M1_SCALPING_SR_ENGULFING_EMA_FILTER"
  };
}

function buildM1StructureEngulfingEmaScalp(candles, closes, context = {}) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (!last || !prev || candles.length < 40) {
    return {
      mode: "M1_SR_ENGULFING_EMA_FILTER",
      activeRule: "M1_SR_ENGULFING_EMA_9_20_FILTER",
      action: "WAIT",
      label: "SCALP WAIT",
      score: 0,
      confidence: 0,
      entry: 0,
      sl: 0,
      tp: 0,
      support: 0,
      resistance: 0,
      ema9: 0,
      ema20: 0,
      emaTrend: "WAIT",
      zone: "WAIT",
      pattern: "NONE",
      reason: "Menunggu minimal 40 candle M1 untuk baca struktur, engulfing, dan EMA 9/20.",
      checklist: []
    };
  }

  const atrValue = Number(context.atr14 || atr(candles, 14) || 1);
  const close = Number(context.close || last.close);
  const recent = candles.slice(-35, -1);
  const structure = detectM1StructureZones(recent, atrValue);
  const support = structure.support;
  const resistance = structure.resistance;
  const zoneBuffer = Math.max(atrValue * 0.35, close * 0.00008);

  const supportTouchCandle = findLastTouchCandle(candles, support, "support", zoneBuffer);
  const resistanceTouchCandle = findLastTouchCandle(candles, resistance, "resistance", zoneBuffer);

  const nearSupport =
    Number.isFinite(support) &&
    last.low <= support + zoneBuffer &&
    last.close >= support - zoneBuffer;

  const nearResistance =
    Number.isFinite(resistance) &&
    last.high >= resistance - zoneBuffer &&
    last.close <= resistance + zoneBuffer;

  const bullishEngulfing = isBullishEngulfing(prev, last);
  const bearishEngulfing = isBearishEngulfing(prev, last);

  const ema9Value = Number(context.ema9 || ema(closes, 9));
  const ema20Value = Number(context.ema20 || ema(closes, 20));
  const emaBullish = ema9Value > ema20Value;
  const emaBearish = ema9Value < ema20Value;
  const emaTrend = emaBullish ? "EMA_BULLISH" : emaBearish ? "EMA_BEARISH" : "EMA_FLAT";

  const rsi = Number(context.rsi14 || rsiWilder(closes, 14));
  const mfiValue = Number(context.mfi14 || mfi(candles, 14));

  const rsiBuyOk = rsi >= 42 && rsi <= 72;
  const rsiSellOk = rsi <= 58 && rsi >= 28;
  const mfiBuyOk = mfiValue >= 38 && mfiValue <= 82;
  const mfiSellOk = mfiValue <= 62 && mfiValue >= 18;

  let buyScore = 0;
  let sellScore = 0;
  const checklist = [];

  if (emaBullish) {
    buyScore += 30;
    checklist.push("EMA 9 di atas EMA 20, hanya cari BUY");
  }

  if (emaBearish) {
    sellScore += 30;
    checklist.push("EMA 9 di bawah EMA 20, hanya cari SELL");
  }

  if (nearSupport) { buyScore += 24; checklist.push("Harga di area support M1"); }
  if (nearResistance) { sellScore += 24; checklist.push("Harga di area resistance M1"); }

  if (bullishEngulfing) { buyScore += 28; checklist.push("Bullish engulfing valid"); }
  if (bearishEngulfing) { sellScore += 28; checklist.push("Bearish engulfing valid"); }

  if (rsiBuyOk) { buyScore += 8; checklist.push("RSI aman untuk BUY"); }
  if (rsiSellOk) { sellScore += 8; checklist.push("RSI aman untuk SELL"); }

  if (mfiBuyOk) { buyScore += 8; checklist.push("MFI aman untuk BUY"); }
  if (mfiSellOk) { sellScore += 8; checklist.push("MFI aman untuk SELL"); }

  const buyValid = emaBullish && nearSupport && bullishEngulfing && buyScore >= 70;
  const sellValid = emaBearish && nearResistance && bearishEngulfing && sellScore >= 70;

  let action = "WAIT";
  let label = "SCALP WAIT";
  let score = Math.max(buyScore, sellScore);
  let sl = 0;
  let tp = 0;
  let zone = "WAIT";
  let pattern = "NONE";

  if (buyValid) {
    action = "SCALP_BUY";
    label = "SCALP BUY";
    zone = "SUPPORT";
    pattern = "BULLISH_ENGULFING";

    // SL M1 scalping:
    // di bawah low candle yang menyentuh support + buffer 1.5 ATR
    const touchLow = Number(supportTouchCandle?.low || support);
    sl = touchLow - atrValue * 1.5;
    const risk = Math.abs(close - sl);
    tp = close + risk * 1.25;
  } else if (sellValid) {
    action = "SCALP_SELL";
    label = "SCALP SELL";
    zone = "RESISTANCE";
    pattern = "BEARISH_ENGULFING";

    // SL M1 scalping:
    // di atas high candle yang menyentuh resistance + buffer 1.5 ATR
    const touchHigh = Number(resistanceTouchCandle?.high || resistance);
    sl = touchHigh + atrValue * 1.5;
    const risk = Math.abs(sl - close);
    tp = close - risk * 1.25;
  } else {
    if (nearSupport) zone = "NEAR_SUPPORT";
    else if (nearResistance) zone = "NEAR_RESISTANCE";

    if (bullishEngulfing) pattern = "BULLISH_ENGULFING";
    else if (bearishEngulfing) pattern = "BEARISH_ENGULFING";
  }

  return {
    mode: "M1_SR_ENGULFING_EMA_FILTER",
    activeRule: "M1_SR_ENGULFING_EMA_9_20_FILTER",
    action,
    label,
    score: Math.min(100, Math.round(score)),
    confidence: Math.min(92, Math.max(45, Math.round(score))),
    entry: round(close),
    sl: round(sl),
    tp: round(tp),
    support: round(support),
    resistance: round(resistance),
    ema9: round(ema9Value),
    ema20: round(ema20Value),
    emaTrend,
    zone,
    pattern,
    atr: round(atrValue),
    zoneBuffer: round(zoneBuffer),
    nearSupport,
    nearResistance,
    bullishEngulfing,
    bearishEngulfing,
    emaBullish,
    emaBearish,
    supportTouchCandle: supportTouchCandle ? {
      time: supportTouchCandle.time,
      low: round(supportTouchCandle.low),
      high: round(supportTouchCandle.high)
    } : null,
    resistanceTouchCandle: resistanceTouchCandle ? {
      time: resistanceTouchCandle.time,
      low: round(resistanceTouchCandle.low),
      high: round(resistanceTouchCandle.high)
    } : null,
    slMethod: "touch_candle_plus_1_5_atr",
    tpMethod: "RR_1_1_25",
    reason: buildSrEngulfingEmaReason({
      action,
      buyScore,
      sellScore,
      support,
      resistance,
      nearSupport,
      nearResistance,
      bullishEngulfing,
      bearishEngulfing,
      emaBullish,
      emaBearish,
      emaTrend,
      checklist
    }),
    checklist: checklist.slice(0, 8)
  };
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
    "SCALP",
    scalpSignal,
    candleKey
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
    type: "SCALP_M1",
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
    pattern: scalp.pattern ?? null,
    zone: scalp.zone ?? null,
    atr: scalp.atr ?? null,
    slMethod: scalp.slMethod || "touch_candle_plus_1_5_atr",
    supportTouchCandle: scalp.supportTouchCandle || null,
    resistanceTouchCandle: scalp.resistanceTouchCandle || null,
    reason: scalp.reason || "",
    candleTime: signal.candleTime || null,
    serverTime: market?.serverTime || null,
    createdAt: new Date().toISOString(),
    status: "OPEN",
    result: null,
    closedAt: null,
    note: ""
  };

  await fbPut(dbUrl, `/xauusd/scalpHistory/${scalpId}`, payload);
  await trimFirebaseList(dbUrl, "/xauusd/scalpHistory", 50);

  return { ok: true, scalpId };
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
    pair: market?.symbol || signal.pair || "XAUUSD",
    signal: signal.signal,
    signalLabel: signal.signalLabel || signal.signal,
    callStage: signal.callStage,
    entry: signal.entry,
    sl: signal.sl,
    tp: signal.tp,
    confidence: signal.confidence,
    probability: signal.strategy?.probability || null,
    reason: signal.reason || "",
    candleTime: signal.candleTime || null,
    serverTime: market?.serverTime || null,
    createdAt: new Date().toISOString(),
    status: "OPEN",
    result: null,
    closedAt: null,
    note: "",
    strategySnapshot: {
      rsi: signal.strategy?.rsi ?? null,
      mfi: signal.strategy?.mfi ?? null,
      ema9: signal.strategy?.ema9 ?? null,
      ema20: signal.strategy?.ema20 ?? null,
      emaCross: signal.strategy?.emaCross ?? null,
      orderBlock: signal.strategy?.orderBlock ?? null,
      confirmation: signal.strategy?.confirmation ?? null,
      buyScore: signal.strategy?.buyScore ?? null,
      sellScore: signal.strategy?.sellScore ?? null
    }
  };

  await fbPut(dbUrl, `/xauusd/callHistory/${callId}`, payload);

  return { ok: true, callId };
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


async function maybeSendTelegramAlert(env, dbUrl, signal, market) {
  const enabled = String(env.TELEGRAM_ALERT_ENABLED || "true").toLowerCase() !== "false";
  const readyEnabled = String(env.TELEGRAM_READY_ALERT_ENABLED || "false").toLowerCase() === "true";

  if (!enabled) return { ok: false, skipped: "telegram-disabled" };
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

  const lastAlert = await fbGet(dbUrl, "/xauusd/telegram/lastAlert");

  if (lastAlert?.alertKey === alertKey) {
    return { ok: true, skipped: "duplicate-alert", alertKey };
  }

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
    `RSI ${formatIndicator(s.rsi)} · MFI ${formatIndicator(s.mfi)}`,
    `EMA 9/20 ${formatIndicator(s.ema9)} / ${formatIndicator(s.ema20)}`,
    `OB M15: ${escapeHtml(obText)}`,
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
    obTimeframe: "M15",
    smc: null,
    orderBlock: { bullish: null, bearish: null },
    buyScore: 0,
    sellScore: 0,
    score: 0
  };
}

function buildCrossMessage(signal, emaCross) {
  if (signal === "BUY") return "RSI + MFI + EMA cross bullish + OB M15 cocok. CALL BUY aktif.";
  if (signal === "SELL") return "RSI + MFI + EMA cross bearish + OB M15 cocok. CALL SELL aktif.";
  if (signal === "READY_BUY") return "Semua konfirmasi mendukung. EMA mendekati bullish cross, siap-siap BUY.";
  if (signal === "READY_SELL") return "Semua konfirmasi mendukung. EMA mendekati bearish cross, siap-siap SELL.";
  return `Belum call. Status EMA: ${emaCross}`;
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
  let mitigated = false;
  let invalidated = false;
  let mitigatedTime = null;
  let invalidatedTime = null;

  const low = Number(ob.low);
  const high = Number(ob.high);
  const mid = (low + high) / 2;

  const afterBos = data.filter((c) => timeToNum(c.time) > timeToNum(ob.bosTime));

  for (const c of afterBos) {
    if (direction === "bullish") {
      const retracedToHalfOb = c.low <= mid;

      if (retracedToHalfOb) {
        mitigated = true;
        mitigatedTime = mitigatedTime || c.time;
      }

      if (c.close < low - atr14 * 0.1) {
        invalidated = true;
        invalidatedTime = c.time;
        break;
      }
    }

    if (direction === "bearish") {
      const retracedToHalfOb = c.high >= mid;

      if (retracedToHalfOb) {
        mitigated = true;
        mitigatedTime = mitigatedTime || c.time;
      }

      if (c.close > high + atr14 * 0.1) {
        invalidated = true;
        invalidatedTime = c.time;
        break;
      }
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
    invalidatedTime,
    fresh: status === "active",
    mitigationRule: "50pct_ob_retrace_after_bos"
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
  if (ob.status !== "active") return null;
  if (ob.mitigated || ob.invalidated) return null;
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
