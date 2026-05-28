const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({
      ok: true,
      message: "Telegram webhook endpoint aktif. Telegram akan POST update ke endpoint ini."
    });
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diset" }, 500);
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: "Body Telegram tidak valid" }, 400);
  }

  const message = update.message || update.edited_message;
  if (!message) return json({ ok: true, skipped: "no-message" });

  const chatId = message.chat?.id;
  const text = String(message.text || "").trim();

  if (!chatId) return json({ ok: true, skipped: "no-chat-id" });
  if (!text.startsWith("/")) return json({ ok: true, skipped: "not-command" });

  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();

  let replyText = "";

  if (command === "/start") {
    replyText = buildStartMessage();
  } else if (command === "/help") {
    replyText = buildHelpMessage();
  } else if (command === "/status") {
    replyText = await buildStatusMessage(env);
  } else if (command === "/signal") {
    replyText = await buildSignalMessage(env);
  } else if (command === "/history") {
    replyText = await buildHistoryMessage(env);
  } else if (command === "/scalp_history" || command === "/scalphistory") {
    replyText = await buildScalpHistoryMessage(env);
  } else {
    replyText = [
      "🤖 <b>Command tidak dikenal.</b>",
      "",
      "Pakai:",
      "/signal - lihat sinyal terbaru",
      "/history - 5 MAIN CALL terakhir",
      "/scalp_history - 5 SCALP M1 valid terakhir",
      "/status - cek koneksi bot",
      "/help - panduan bot"
    ].join("\n");
  }

  const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, replyText);

  return json({
    ok: sent.ok,
    command,
    chatId,
    status: sent.status,
    response: sent.response
  }, sent.ok ? 200 : 500);
}

function buildStartMessage() {
  return [
    "🔥 <b>XAU AI Signal Alert aktif.</b>",
    "",
    "Bot ini mengirim CALL BUY/SELL XAUUSD saat setup valid dari data MT5.",
    "",
    "<b>Strategi:</b>",
    "• RSI 14",
    "• MFI 14",
    "• EMA Cross 9/20",
    "• Order Block M15",
    "• AI Analysis",
    "",
    "<b>Command:</b>",
    "/signal - cek sinyal terbaru",
    "/history - 5 CALL terakhir",
    "/status - cek koneksi bot",
    "/help - panduan",
    "",
    "<i>Bukan financial advice. XAUUSD galak, risk management wajib.</i>"
  ].join("\n");
}

function buildHelpMessage() {
  return [
    "📌 <b>Panduan Bot</b>",
    "",
    "<b>READY</b> = siap-siap, belum entry.",
    "<b>CALL</b> = BUY/SELL valid.",
    "<b>SL</b> = patokan OB M15 + ATR.",
    "<b>TP</b> = risk × 1.7.",
    "",
    "Bot otomatis kirim alert saat CALL valid.",
    "",
    "<b>Command:</b>",
    "/signal - sinyal terbaru",
    "/history - 5 CALL terakhir",
    "/status - status koneksi",
    "/help - bantuan",
    "",
    "<i>Demo first. XAUUSD galak, risk management wajib.</i>"
  ].join("\n");
}



async function buildScalpHistoryMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return "❌ Firebase belum diset.";

  const raw = await fbGet(dbUrl, "/xauusd/scalpHistory");
  const list = Object.values(raw || {})
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (!list.length) {
    return "⚡ Belum ada SCALP M1 valid yang tersimpan. History hanya masuk saat SCALP BUY/SELL valid, bukan SCALP WAIT.";
  }

  const stats = buildHistoryStats(list);
  const top = list.slice(0, 5);

  const rows = top.map((x, i) => {
    const icon = x.result === "WIN" ? "✅" : x.result === "LOSS" ? "❌" : x.result === "BE" ? "➖" : "🟡";
    return [
      `${i + 1}. ${icon} <b>${escapeHtml(x.signal || "-")}</b> ${escapeHtml(x.status || "OPEN")}`,
      `Entry ${x.entry} | SL ${x.sl || "-"} | TP ${x.tp || "-"}`,
      `Score ${x.score ?? x.confidence ?? "-"}% | Pattern ${escapeHtml(humanize(x.pattern))}`,
      `${escapeHtml(x.createdAt || "-")}`
    ].join("\n");
  }).join("\n\n");

  return [
    "⚡ <b>SCALP M1 Valid History</b>",
    "",
    `<b>Total:</b> ${stats.total} | <b>Open:</b> ${stats.open} | <b>Closed:</b> ${stats.closed}`,
    `<b>Win:</b> ${stats.wins} | <b>Loss:</b> ${stats.losses} | <b>BE:</b> ${stats.be}`,
    `<b>Win Rate:</b> ${stats.winRate}%`,
    "",
    rows,
    "",
    "<i>Hanya SCALP BUY/SELL valid yang disimpan. SCALP WAIT tidak disimpan biar Firebase hemat.</i>"
  ].join("\n");
}


async function buildHistoryMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return "❌ Firebase belum diset.";

  const raw = await fbGet(dbUrl, "/xauusd/callHistory");
  const list = Object.values(raw || {})
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (!list.length) {
    return "📒 Belum ada CALL history. History otomatis terisi saat CALL BUY/SELL valid.";
  }

  const stats = buildHistoryStats(list);
  const top = list.slice(0, 5);

  const rows = top.map((x, i) => {
    const icon = x.result === "WIN" ? "✅" : x.result === "LOSS" ? "❌" : x.result === "BE" ? "➖" : "🟡";
    return [
      `${i + 1}. ${icon} <b>${escapeHtml(x.signal || "-")}</b> ${escapeHtml(x.status || "OPEN")}`,
      `Entry ${x.entry} | SL ${x.sl || "-"} | TP ${x.tp || "-"}`,
      `Prob ${x.probability?.score ?? x.confidence ?? "-"}% | ${escapeHtml(x.createdAt || "-")}`
    ].join("\n");
  }).join("\n\n");

  return [
    "📒 <b>CALL History</b>",
    "",
    `<b>Total:</b> ${stats.total} | <b>Open:</b> ${stats.open} | <b>Closed:</b> ${stats.closed}`,
    `<b>Win:</b> ${stats.wins} | <b>Loss:</b> ${stats.losses} | <b>BE:</b> ${stats.be}`,
    `<b>Win Rate:</b> ${stats.winRate}%`,
    "",
    rows
  ].join("\n");
}

function buildHistoryStats(list) {
  const closed = list.filter((x) => x.status === "CLOSED");
  const wins = closed.filter((x) => x.result === "WIN").length;
  const losses = closed.filter((x) => x.result === "LOSS").length;
  const be = closed.filter((x) => x.result === "BE").length;
  const totalClosed = closed.length;
  const winRate = totalClosed > 0 ? Number(((wins / totalClosed) * 100).toFixed(1)) : 0;
  const open = list.filter((x) => x.status !== "CLOSED").length;
  return { total: list.length, open, closed: totalClosed, wins, losses, be, winRate };
}


async function buildStatusMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const telegramReady = Boolean(env.TELEGRAM_BOT_TOKEN);
  const firebaseReady = Boolean(dbUrl);

  let market = null;
  if (dbUrl) {
    market = await fbGet(dbUrl, "/xauusd/latest");
  }

  const hasMt5 = Boolean(market?.ok && Array.isArray(market?.candles));

  return [
    "✅ <b>Status Bot</b>",
    "",
    `${telegramReady ? "✅" : "❌"} Telegram token: ${telegramReady ? "aktif" : "belum diset"}`,
    `${firebaseReady ? "✅" : "❌"} Firebase: ${firebaseReady ? "aktif" : "belum diset"}`,
    `${hasMt5 ? "✅" : "❌"} MT5 data: ${hasMt5 ? "diterima" : "belum ada"}`,
    "",
    `<b>Pair:</b> ${escapeHtml(market?.symbol || "-")}`,
    `<b>Last update:</b> ${escapeHtml(market?.serverTime || market?.receivedAt || "-")}`,
    `<b>M1 candle:</b> ${Array.isArray(market?.candles) ? market.candles.length : 0}`,
    `<b>M15 candle:</b> ${Array.isArray(market?.candlesM15) ? market.candlesM15.length : 0}`,
    "",
    `<b>Alert CALL:</b> ${String(env.TELEGRAM_ALERT_ENABLED || "true").toLowerCase() !== "false" ? "ON" : "OFF"}`,
    `<b>Alert READY:</b> ${String(env.TELEGRAM_READY_ALERT_ENABLED || "false").toLowerCase() === "true" ? "ON" : "OFF"}`
  ].join("\n");
}

async function buildSignalMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) {
    return "❌ Firebase belum diset. Isi ENV FIREBASE_DATABASE_URL dulu.";
  }

  const market = await fbGet(dbUrl, "/xauusd/latest");

  if (!market?.ok) {
    return "⏳ Belum ada data MT5 di Firebase. Pastikan EA MT5 aktif.";
  }

  const signal = buildSignal(
    Array.isArray(market.candles) ? market.candles : [],
    Array.isArray(market.candlesM15) ? market.candlesM15 : [],
    market
  );

  const s = signal.strategy || {};
  const c = s.confirmation || {};
  const rawBullOb = s.orderBlock?.bullish;
  const rawBearOb = s.orderBlock?.bearish;
  const obBull = getFreshObForDisplay(rawBullOb);
  const obBear = getFreshObForDisplay(rawBearOb);

  const emoji = signal.signal === "BUY" ? "🟢" : signal.signal === "SELL" ? "🔴" : signal.callStage === "READY" ? "🟡" : "⚪";

  return [
    `${emoji} <b>XAUUSD Signal Radar</b>`,
    "",
    `<b>Status:</b> ${escapeHtml(signal.signalLabel || signal.signal)} · ${escapeHtml(signal.callStage)}`,
    `<b>Main Confidence:</b> ${signal.confidence}%`,
    `<b>Area Entry:</b> ${signal.entry}`,
    `<b>Safety SL:</b> ${signal.sl || "-"}`,
    `<b>Target TP:</b> ${signal.tp || "-"}`,
    "",
    `<b>Momentum:</b> RSI ${s.rsi ?? "-"} · MFI ${s.mfi ?? "-"}`,
    `<b>Trend EMA 9/20:</b> ${s.ema9 ?? "-"} / ${s.ema20 ?? "-"}`,
    `<b>EMA Status:</b> ${escapeHtml(humanize(s.emaCross))}`,
    "",
    `⚡ <b>M1 Scalping:</b> ${escapeHtml(s.scalping?.label || "SCALP WAIT")} · ${s.scalping?.confidence || 0}%`,
    `Quick plan: Entry ${s.scalping?.entry || "-"} · SL ${s.scalping?.sl || "-"} · TP ${s.scalping?.tp || "-"}`,
    `Filter: EMA9 ${s.scalping?.ema9 || "-"} · EMA20 ${s.scalping?.ema20 || "-"} · ${escapeHtml(humanize(s.scalping?.emaTrend))}`,
    `Structure: Support ${s.scalping?.support || "-"} · Resistance ${s.scalping?.resistance || "-"} · Pattern ${escapeHtml(humanize(s.scalping?.pattern))}`,
    `Note: ${escapeHtml(s.scalping?.reason || "M1 belum kasih momentum yang cakep.")}`,
    "",
    `🎯 <b>Fresh OB M15:</b>`,
    `Demand/Bullish: ${escapeHtml(formatOb(obBull))}`,
    `Supply/Bearish: ${escapeHtml(formatOb(obBear))}`,
    "",
    `✅ <b>Checklist Setup:</b>`,
    `BUY side: RSI ${c.rsiBuyOk ? "✅" : "❌"} · MFI ${c.mfiBuyOk ? "✅" : "❌"} · OB ${c.obBuyOk ? "✅" : "❌"}`,
    `SELL side: RSI ${c.rsiSellOk ? "✅" : "❌"} · MFI ${c.mfiSellOk ? "✅" : "❌"} · OB ${c.obSellOk ? "✅" : "❌"}`,
    "",
    `🧠 <b>Main AI Note:</b> ${escapeHtml(signal.reason || "-")}`,
    "",
    "<i>Demo first. XAUUSD galak, risk management wajib.</i>"
  ].join("\n");
}

async function sendTelegram(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
  return await res.json();
}

function buildSignal(candles, candlesM15, market) {
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
      reason: "Menunggu minimal 50 candle M1.",
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

  const buyAllMatch = bullishCrossNow && rsiBuyOk && mfiBuyOk && obBuyOk;
  const sellAllMatch = bearishCrossNow && rsiSellOk && mfiSellOk && obSellOk;
  const readyBuyAllMatch = readyBuy && rsiBuyOk && mfiBuyOk && obBuyOk;
  const readySellAllMatch = readySell && rsiSellOk && mfiSellOk && obSellOk;

  let signal = "WAIT";
  let callStage = "WAIT";
  let signalLabel = "WAIT";
  let reason = "Belum call karena RSI + MFI + EMA 9/20 + area OB M15 belum cocok semua.";

  if (readyBuyAllMatch) {
    signal = "READY_BUY";
    callStage = "READY";
    signalLabel = "SIAP-SIAP BUY";
    reason = "Semua konfirmasi mendukung. EMA mendekati bullish cross, siap-siap BUY.";
  } else if (readySellAllMatch) {
    signal = "READY_SELL";
    callStage = "READY";
    signalLabel = "SIAP-SIAP SELL";
    reason = "Semua konfirmasi mendukung. EMA mendekati bearish cross, siap-siap SELL.";
  }

  if (buyAllMatch) {
    signal = "BUY";
    callStage = "CALL";
    signalLabel = "BUY";
    reason = "RSI + MFI + EMA cross bullish + OB M15 cocok. CALL BUY aktif.";
  } else if (sellAllMatch) {
    signal = "SELL";
    callStage = "CALL";
    signalLabel = "SELL";
    reason = "RSI + MFI + EMA cross bearish + OB M15 cocok. CALL SELL aktif.";
  }

  let sl = 0;
  let tp = 0;

  if (signal === "BUY") {
    sl = bullOb ? Math.min(bullOb.low, close - atr14 * 1.1) : close - atr14 * 1.4;
    tp = close + Math.abs(close - sl) * 1.7;
  } else if (signal === "SELL") {
    sl = bearOb ? Math.max(bearOb.high, close + atr14 * 1.1) : close + atr14 * 1.4;
    tp = close - Math.abs(sl - close) * 1.7;
  }

  const buyScore = (bullishCrossNow ? 34 : readyBuy ? 18 : 0) + (rsiBuyOk ? 16 : 0) + (mfiBuyOk ? 16 : 0) + (obBuyOk ? 18 : 0);
  const sellScore = (bearishCrossNow ? 34 : readySell ? 18 : 0) + (rsiSellOk ? 16 : 0) + (mfiSellOk ? 16 : 0) + (obSellOk ? 18 : 0);
  const score = Math.max(buyScore, sellScore);

  const confidence = callStage === "READY"
    ? Math.min(82, Math.max(58, Math.round(score)))
    : callStage === "CALL"
      ? Math.min(95, Math.max(68, Math.round(score)))
      : Math.min(60, Math.max(45, Math.round(score)));

  const scalping = buildM1ScalpingStrategy(m1, closes, {
    ema9,
    ema20,
    rsi14,
    mfi14,
    atr14,
    close
  });

  return {
    signal,
    signalLabel,
    callStage,
    confidence,
    entry: round(close),
    sl: round(sl),
    tp: round(tp),
    reason,
    strategy: {
      scalping,
      rsi: round(rsi14),
      mfi: round(mfi14),
      ema9: round(ema9),
      ema20: round(ema20),
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
      orderBlock: { bullish: bullOb, bearish: bearOb }
    }
  };
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


function emptyStrategy() {
  return {
    rsi: null,
    mfi: null,
    ema9: null,
    ema20: null,
    emaCross: "WAIT",
    confirmation: {},
    orderBlock: { bullish: null, bearish: null }
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: H
  });
}
