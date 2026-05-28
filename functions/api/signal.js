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

  return json({
    ...signal,
    telegram,
    callHistory
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
    reason: reasons.slice(0, 7).join(" "),
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



function buildM1ScalpingStrategy(candles, closes, context = {}) {
  const last = candles[candles.length - 1];
  if (!last || closes.length < 30) {
    return {
      mode: "M1_SCALPING",
      action: "WAIT",
      label: "WAIT",
      score: 0,
      confidence: 0,
      entry: 0,
      sl: 0,
      tp: 0,
      reason: "Menunggu minimal 30 candle M1 untuk scalping.",
      checklist: []
    };
  }

  const ema5 = ema(closes, 5);
  const ema13 = ema(closes, 13);
  const prevEma5 = ema(closes.slice(0, -1), 5);
  const prevEma13 = ema(closes.slice(0, -1), 13);
  const atrValue = Number(context.atr14 || atr(candles, 14) || 1);
  const close = Number(context.close || last.close);

  const recent = candles.slice(-12, -1);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));

  const volumes = candles.slice(-21, -1).map((c) => Number(c.volume || 0));
  const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const volumeSpike = Number(last.volume || 0) >= avgVolume * 1.15;

  const bullishCross = prevEma5 <= prevEma13 && ema5 > ema13;
  const bearishCross = prevEma5 >= prevEma13 && ema5 < ema13;
  const bullishTrend = ema5 > ema13 && close > ema9Safe(context.ema9, ema5);
  const bearishTrend = ema5 < ema13 && close < ema9Safe(context.ema9, ema5);

  const breakoutUp = close > recentHigh + atrValue * 0.03;
  const breakoutDown = close < recentLow - atrValue * 0.03;

  const rsi = Number(context.rsi14 || rsiWilder(closes, 14));
  const mfiValue = Number(context.mfi14 || mfi(candles, 14));

  const rsiBuy = rsi >= 50 && rsi <= 74;
  const rsiSell = rsi <= 50 && rsi >= 26;
  const mfiBuy = mfiValue >= 50 && mfiValue <= 82;
  const mfiSell = mfiValue <= 50 && mfiValue >= 18;

  let buyScore = 0;
  let sellScore = 0;
  const checklist = [];

  if (bullishCross) { buyScore += 24; checklist.push("EMA5 cross up EMA13"); }
  if (bearishCross) { sellScore += 24; checklist.push("EMA5 cross down EMA13"); }

  if (bullishTrend) { buyScore += 18; checklist.push("Trend M1 bullish"); }
  if (bearishTrend) { sellScore += 18; checklist.push("Trend M1 bearish"); }

  if (breakoutUp) { buyScore += 18; checklist.push("Break high 12 candle M1"); }
  if (breakoutDown) { sellScore += 18; checklist.push("Break low 12 candle M1"); }

  if (rsiBuy) { buyScore += 14; checklist.push("RSI support BUY"); }
  if (rsiSell) { sellScore += 14; checklist.push("RSI support SELL"); }

  if (mfiBuy) { buyScore += 14; checklist.push("MFI support BUY"); }
  if (mfiSell) { sellScore += 14; checklist.push("MFI support SELL"); }

  if (volumeSpike) {
    buyScore += bullishTrend || breakoutUp ? 8 : 0;
    sellScore += bearishTrend || breakoutDown ? 8 : 0;
    checklist.push("Volume spike");
  }

  let action = "WAIT";
  let label = "SCALP WAIT";
  let score = Math.max(buyScore, sellScore);

  const buyValid = buyScore >= 58 && buyScore > sellScore + 8;
  const sellValid = sellScore >= 58 && sellScore > buyScore + 8;

  if (buyValid) {
    action = "SCALP_BUY";
    label = "SCALP BUY";
  } else if (sellValid) {
    action = "SCALP_SELL";
    label = "SCALP SELL";
  }

  let sl = 0;
  let tp = 0;

  if (action === "SCALP_BUY") {
    sl = Math.min(recentLow, close - atrValue * 0.9);
    tp = close + Math.abs(close - sl) * 1.25;
  }

  if (action === "SCALP_SELL") {
    sl = Math.max(recentHigh, close + atrValue * 0.9);
    tp = close - Math.abs(sl - close) * 1.25;
  }

  return {
    mode: "M1_SCALPING",
    action,
    label,
    score: Math.round(score),
    confidence: Math.min(88, Math.max(45, Math.round(score))),
    entry: round(close),
    sl: round(sl),
    tp: round(tp),
    ema5: round(ema5),
    ema13: round(ema13),
    recentHigh: round(recentHigh),
    recentLow: round(recentLow),
    volumeSpike,
    avgVolume: round(avgVolume),
    reason: buildScalpReason(action, buyScore, sellScore, checklist),
    checklist: checklist.slice(0, 7)
  };
}

function ema9Safe(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildScalpReason(action, buyScore, sellScore, checklist) {
  const buy = Math.round(buyScore);
  const sell = Math.round(sellScore);
  const dominant = buy >= sell ? "BUY" : "SELL";
  const dominantScore = Math.max(buy, sell);
  const confirmations = checklist.length ? checklist.slice(0, 4).join(" • ") : "belum ada konfirmasi kuat";

  if (action === "SCALP_BUY") {
    return `🚀 M1 scalp lagi gas ke BUY. BUY power ${buy}/100 vs SELL ${sell}/100. Setup sudah valid buat SCALP BUY, tapi tetap pakai risk tipis. Konfirmasi: ${confirmations}.`;
  }

  if (action === "SCALP_SELL") {
    return `🔻 M1 scalp lagi berat ke SELL. SELL power ${sell}/100 vs BUY ${buy}/100. Setup sudah valid buat SCALP SELL, jangan lupa jaga SL. Konfirmasi: ${confirmations}.`;
  }

  if (dominantScore >= 45) {
    return `👀 Bias M1 mulai condong ${dominant}, tapi belum cukup matang buat entry. BUY power ${buy}/100, SELL power ${sell}/100. Tunggu power minimal 58/100 biar keluar SCALP BUY/SELL. Yang kebaca: ${confirmations}.`;
  }

  return `😴 M1 masih kalem, belum ada momentum cakep. BUY power ${buy}/100, SELL power ${sell}/100. Tunggu candle yang lebih niat dulu, jangan maksa entry.`;
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
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { ok: false, skipped: "telegram-env-missing" };
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
  const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);

  if (sent.ok) {
    await fbPut(dbUrl, "/xauusd/telegram/lastAlert", {
      alertKey,
      signal: signal.signal,
      callStage: signal.callStage,
      candleTime: signal.candleTime || null,
      sentAt: new Date().toISOString()
    });
  }

  return { ok: sent.ok, alertKey, status: sent.status, response: sent.response };
}

function buildTelegramMessage(signal, market) {
  const s = signal.strategy || {};
  const c = s.confirmation || {};
  const rawBullOb = s.orderBlock?.bullish;
  const rawBearOb = s.orderBlock?.bearish;
  const obBull = getFreshObForDisplay(rawBullOb);
  const obBear = getFreshObForDisplay(rawBearOb);

  const emoji = signal.signal === "BUY" ? "🟢" : signal.signal === "SELL" ? "🔴" : "🟡";
  const title = signal.callStage === "CALL" ? "CALL SIGNAL VALID" : "READY ALERT";

  const obText = signal.signal.includes("BUY")
    ? formatOb(obBull)
    : signal.signal.includes("SELL")
      ? formatOb(obBear)
      : `Bull ${formatOb(obBull)} | Bear ${formatOb(obBear)}`;

  return [
    `${emoji} <b>${title} - ${escapeHtml(signal.signalLabel || signal.signal)}</b>`,
    ``,
    `<b>Pair:</b> ${escapeHtml(market?.symbol || signal.pair || "XAUUSD")}`,
    `<b>TF Signal:</b> ${escapeHtml(market?.timeframe || "M1")}`,
    `<b>TF OB:</b> M15`,
    `<b>Main Confidence:</b> ${signal.confidence}%`,
    ``,
    `<b>Area Entry:</b> ${signal.entry}`,
    `<b>Safety SL:</b> ${signal.sl || "-"}`,
    `<b>Target TP:</b> ${signal.tp || "-"}`,
    ``,
    `<b>RSI:</b> ${s.rsi} | <b>MFI:</b> ${s.mfi}`,
    `<b>EMA9/20:</b> ${s.ema9} / ${s.ema20}`,
    `<b>EMA Status:</b> ${escapeHtml(humanize(s.emaCross))}`,
    `<b>OB M15:</b> ${escapeHtml(obText)}`,
    ``,
    `✅ <b>Checklist Setup:</b>`,
    `RSI BUY ${c.rsiBuyOk ? "✅" : "❌"} | MFI BUY ${c.mfiBuyOk ? "✅" : "❌"} | OB BUY ${c.obBuyOk ? "✅" : "❌"}`,
    `RSI SELL ${c.rsiSellOk ? "✅" : "❌"} | MFI SELL ${c.mfiSellOk ? "✅" : "❌"} | OB SELL ${c.obSellOk ? "✅" : "❌"}`,
    ``,
    `🧠 <b>Main AI Note:</b> ${escapeHtml(signal.reason || "-")}`,
    ``,
    `<i>Bukan financial advice. Demo first, risk management wajib.</i>`
  ].join("\n");
}

async function sendTelegram(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
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
