const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "Live Data Engine belum tersambung." }, 500);

  if (request.method === "GET") {
    const summary = await buildTrackerSummary(dbUrl, env, false);
    return json({ ok: true, ...summary });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Kode admin tidak valid." }, 401);
  }

  const summary = await buildTrackerSummary(dbUrl, env, true);
  return json({
    ok: true,
    message: buildMessage(summary),
    ...summary
  });
}

export async function buildTrackerSummary(dbUrl, env, shouldUpdate) {
  const controls = await getStrategyControls(dbUrl);
  const market = await fbGet(dbUrl, "/xauusd/latest");
  const livePrice = getMarketPrice(market);
  const maxItems = Number(env.RESULT_TRACKER_MAX_ITEMS || 20);
  const mainExpireHours = Number(env.RESULT_TRACKER_MAIN_EXPIRE_HOURS || 24);
  const scalpExpireHours = Number(env.RESULT_TRACKER_SCALP_EXPIRE_HOURS || 4);
  const strategyBExpireHours = Number(env.RESULT_TRACKER_STRATEGY_B_EXPIRE_HOURS || 24);

  const [callRaw, scalpRaw, strategyBRaw] = await Promise.all([
    fbGet(dbUrl, "/xauusd/callHistory"),
    fbGet(dbUrl, "/xauusd/scalpHistory"),
    fbGet(dbUrl, "/xauusd/strategyB/history")
  ]);

  const callItems = Object.values(callRaw || {}).filter(Boolean);
  const scalpItems = Object.values(scalpRaw || {}).filter(Boolean);
  const strategyBItems = Object.values(strategyBRaw || {}).filter(Boolean);

  const allOpen = [
    ...callItems.map((item) => ({ ...item, trackerType: "MAIN_CALL", path: "/xauusd/callHistory", expireHours: mainExpireHours, telegramResultAlert: controls.mainSignalResultAlert !== false })),
    ...(controls.m1ScalpResultTracking === false ? [] : scalpItems.map((item) => ({ ...item, trackerType: "SCALP_M1", path: "/xauusd/scalpHistory", expireHours: scalpExpireHours, telegramResultAlert: true }))),
    ...(controls.strategyBLiveBacktest === false ? [] : strategyBItems.map((item) => ({ ...item, trackerType: "SMC_AI", path: "/xauusd/strategyB/history", expireHours: strategyBExpireHours, telegramResultAlert: controls.strategyBResultAdminAlert !== false, strategyBResultAlert: true })))
  ]
    .filter(isOpen)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .slice(0, maxItems);

  const checked = [];
  const updated = [];

  for (const item of allOpen) {
    const result = evaluateItem(item, livePrice);
    checked.push({
      id: item.id,
      type: item.trackerType,
      signal: item.signal,
      entry: toNumber(item.entry),
      sl: toNumber(item.sl),
      tp: toNumber(item.tp),
      status: result.result || "RUNNING",
      reason: result.note
    });

    if (shouldUpdate && result.result && item.id) {
      const closedAt = new Date().toISOString();
      const payload = {
        ...item,
        status: "CLOSED",
        result: result.result,
        closedAt,
        resultPrice: livePrice,
        resultSource: "AUTO_RESULT_ENGINE",
        resultCheckedAt: closedAt,
        note: result.note
      };

      delete payload.path;
      delete payload.expireHours;
      delete payload.trackerType;

      const alertResult = item.telegramResultAlert
        ? await maybeSendResultAlert(env, item, payload, result.result, livePrice, result.note)
        : { sent: false, skippedReason: "RESULT_ALERT_DISABLED_FOR_TRACKER" };

      if (alertResult.sent) {
        payload.resultAlertSent = true;
        payload.resultAlertSentAt = closedAt;
        payload.resultAlertChannel = "TELEGRAM_GLOBAL";
      }

      if (alertResult.skippedReason) {
        payload.resultAlertSkippedReason = alertResult.skippedReason;
      }

      if (item.trackerType === "SMC_AI") {
        payload.resultSourceNote = "Strategy B SMC AI live-backtest result. Auto admin result alert aktif hanya untuk Telegram admin/global.";
      }

      await fbPut(dbUrl, `${item.path}/${item.id}`, payload);
      updated.push({
        id: item.id,
        type: item.trackerType,
        signal: item.signal,
        result: result.result,
        price: livePrice,
        note: result.note,
        resultAlertSent: alertResult.sent,
        resultAlertStatus: alertResult.status || null,
        resultAlertSkippedReason: alertResult.skippedReason || null,
        liveBacktestOnly: item.trackerType === "SMC_AI"
      });
    }
  }

  return {
    livePrice,
    scanned: allOpen.length,
    updatedCount: updated.length,
    resultAlertSentCount: updated.filter((item) => item.resultAlertSent).length,
    resultAlertSkippedCount: updated.filter((item) => item.resultAlertSkippedReason).length,
    updated,
    checked,
    mode: shouldUpdate ? "AUTO_UPDATE" : "PREVIEW",
    checkedAt: new Date().toISOString()
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

async function maybeSendResultAlert(env, originalItem, closedPayload, result, livePrice, note) {
  if (String(env.RESULT_ALERT_ENABLED || "true").toLowerCase() === "false") {
    return { sent: false, skippedReason: "RESULT_ALERT_DISABLED" };
  }

  if (originalItem.resultAlertSent || closedPayload.resultAlertSent) {
    return { sent: false, skippedReason: "RESULT_ALERT_ALREADY_SENT" };
  }

  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";
  if (!botToken || !chatId) {
    return { sent: false, skippedReason: "TELEGRAM_GATEWAY_NOT_READY" };
  }

  if (String(originalItem.trackerType || "").toUpperCase() === "SMC_AI") {
    const enabled = String(env.STRATEGY_B_AUTO_RESULT_ADMIN_ALERT_ENABLED ?? "true").toLowerCase() !== "false";
    if (!enabled) {
      return { sent: false, skippedReason: "STRATEGY_B_AUTO_RESULT_ADMIN_ALERT_DISABLED" };
    }
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || "https://www.xauaisignal.online";
  const text = String(originalItem.trackerType || "").toUpperCase() === "SMC_AI"
    ? buildSmcAutoResultTelegramMessage(originalItem, closedPayload, result, livePrice, note, dashboardUrl)
    : buildResultTelegramMessage(originalItem, closedPayload, result, livePrice, note, dashboardUrl);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: "🚀 Open Premium Dashboard", url: dashboardUrl }
        ]]
      }
    })
  });

  let response = null;
  try { response = await res.json(); } catch { response = await res.text(); }

  if (!res.ok) {
    return { sent: false, status: res.status, response, skippedReason: "TELEGRAM_SEND_FAILED" };
  }

  return { sent: true, status: res.status, response };
}

function buildSmcAutoResultTelegramMessage(item, payload, result, livePrice, note, dashboardUrl) {
  const signal = String(item.signal || item.direction || "-").toUpperCase();
  const pair = escapeHtml(item.pair || item.symbol || "XAUUSD+");
  const confidence = Number(item.confidence);
  const confidenceText = Number.isFinite(confidence) ? `${confidence}%` : "-";
  const rrText = escapeHtml(item.rr || item.riskReward || "1:2");
  const durationText = buildDurationText(item.createdAt || item.candleTime || item.serverTime, payload.closedAt);
  const title = result === "WIN"
    ? "✅ SMC AI RESULT · WIN"
    : result === "LOSS"
      ? "❌ SMC AI RESULT · LOSS"
      : "⚪ SMC AI RESULT · EXPIRED";

  const resultLine = result === "WIN"
    ? "Target profit SMC AI berhasil tercapai."
    : result === "LOSS"
      ? "Setup SMC AI selesai di area stop loss."
      : "Setup SMC AI tidak menyentuh TP/SL dalam batas waktu.";

  const actionLine = result === "WIN"
    ? "Catat performa Strategy B dan tunggu setup SMC berikutnya."
    : result === "LOSS"
      ? "Tetap evaluasi checklist SMC. Fokus pada data live-backtest, bukan satu trade."
      : "Abaikan setup SMC lama dan tunggu rangkaian OB → Sweep → CHOCH → EMA berikutnya.";

  return [
    `<b>${title}</b>`,
    `<i>Strategy B · Live Backtest Only</i>`,
    "",
    `<b>Signal:</b> ${escapeHtml(signal)} ${pair}`,
    `<b>Entry:</b> ${formatPrice(item.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(item.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(item.tp)}`,
    `<b>Result Price:</b> ${formatPrice(livePrice)}`,
    `<b>RR:</b> ${rrText}`,
    `<b>Confidence Awal:</b> ${escapeHtml(confidenceText)}`,
    `<b>Duration:</b> ${escapeHtml(durationText)}`,
    "",
    "🧠 <b>SMC Checklist</b>",
    `<b>OB M15:</b> ${escapeHtml(readSmcFlag(item, "ob", "VALID"))}`,
    `<b>Sweep M1:</b> ${escapeHtml(readSmcFlag(item, "sweep", "YES"))}`,
    `<b>CHOCH M1:</b> ${escapeHtml(readSmcFlag(item, "choch", "YES"))}`,
    `<b>EMA M1:</b> ${escapeHtml(readSmcFlag(item, "ema", "YES"))}`,
    "",
    "🎯 <b>Result</b>",
    escapeHtml(resultLine),
    note ? escapeHtml(note) : "",
    "",
    "🧭 <b>Action</b>",
    escapeHtml(actionLine),
    "",
    "⚠️ <b>Mode</b>",
    "Auto result alert ini hanya untuk Telegram admin/global. SMC AI belum dikirim ke user premium.",
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    "<i>Bukan financial advice.</i>"
  ].filter(Boolean).join("\n");
}

function readSmcFlag(item, key, fallback) {
  const checklist = item.checklist || item.smcChecklist || item.details || {};
  const value = item[key] ?? item[`${key}Status`] ?? checklist[key] ?? checklist[`${key}Status`] ?? fallback;
  if (typeof value === "boolean") return value ? "YES" : "WAIT";
  if (typeof value === "object" && value) {
    if (value.valid === true || value.passed === true) return "YES";
    if (value.status) return value.status;
  }
  return value || fallback;
}

function buildResultTelegramMessage(item, payload, result, livePrice, note, dashboardUrl) {
  const signal = String(item.signal || "-").toUpperCase();
  const pair = escapeHtml(item.pair || item.symbol || "XAUUSD+");
  const type = String(item.trackerType || "MAIN_CALL").replace(/_/g, " ");
  const confidence = Number(item.confidence);
  const confidenceText = Number.isFinite(confidence) ? `${confidence}%` : "-";
  const durationText = buildDurationText(item.createdAt || item.candleTime || item.serverTime, payload.closedAt);
  const title = result === "WIN"
    ? "✅ XAU AI RESULT · WIN"
    : result === "LOSS"
      ? "❌ XAU AI RESULT · LOSS"
      : "⚪ XAU AI RESULT · EXPIRED";

  const resultLine = result === "WIN"
    ? "Target profit berhasil tercapai."
    : result === "LOSS"
      ? "Setup selesai di area stop loss."
      : "Setup tidak menyentuh TP/SL dalam batas waktu.";

  const actionLine = result === "WIN"
    ? "Kunci profit dan tunggu setup premium berikutnya."
    : result === "LOSS"
      ? "Tetap disiplin risk management. Fokus pada konsistensi, bukan satu trade."
      : "Abaikan setup lama dan tunggu peluang baru.";

  return [
    `<b>${title}</b>`,
    `<i>${escapeHtml(type)} sudah selesai dipantau oleh Auto Result Engine.</i>`,
    "",
    `<b>Signal:</b> ${escapeHtml(signal)} ${pair}`,
    `<b>Entry:</b> ${formatPrice(item.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(item.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(item.tp)}`,
    `<b>Result Price:</b> ${formatPrice(livePrice)}`,
    `<b>Confidence Awal:</b> ${escapeHtml(confidenceText)}`,
    `<b>Duration:</b> ${escapeHtml(durationText)}`,
    "",
    "🎯 <b>Result</b>",
    escapeHtml(resultLine),
    note ? escapeHtml(note) : "",
    "",
    "🧠 <b>Action</b>",
    escapeHtml(actionLine),
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    "<i>Bukan financial advice.</i>"
  ].filter(Boolean).join("\n");
}

function buildDurationText(start, end) {
  const startMs = new Date(start || 0).getTime();
  const endMs = new Date(end || Date.now()).getTime();
  if (!Number.isFinite(startMs) || startMs <= 0 || !Number.isFinite(endMs)) return "-";
  const minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours} jam ${mins} menit` : `${hours} jam`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function evaluateItem(item, livePrice) {
  const signal = String(item.signal || "").toUpperCase();
  const sl = toNumber(item.sl);
  const tp = toNumber(item.tp);

  if (!Number.isFinite(livePrice) || livePrice <= 0) {
    return { result: null, note: "Harga live belum tersedia." };
  }

  if (!Number.isFinite(sl) || !Number.isFinite(tp)) {
    return { result: null, note: "SL/TP belum lengkap." };
  }

  if (signal === "BUY") {
    if (livePrice >= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (livePrice <= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  if (signal === "SELL") {
    if (livePrice <= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (livePrice >= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  const ageHours = getAgeHours(item.createdAt || item.candleTime || item.serverTime);
  const expireHours = Number(item.expireHours || 24);
  if (ageHours >= expireHours) {
    return { result: "EXPIRED", note: `Signal melewati batas waktu ${expireHours} jam tanpa menyentuh TP/SL.` };
  }

  return { result: null, note: "Masih berjalan. Belum menyentuh TP/SL." };
}

function isOpen(item) {
  const status = String(item?.status || "OPEN").toUpperCase();
  const result = String(item?.result || "").toUpperCase();
  return status !== "CLOSED" && !["WIN", "LOSS", "BE", "EXPIRED"].includes(result);
}

function getMarketPrice(market) {
  const direct = toNumber(market?.lastPrice ?? market?.price ?? market?.latest?.lastPrice ?? market?.m1?.lastPrice);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const candles = market?.m1 || market?.candles?.m1 || market?.candlesM1 || [];
  if (Array.isArray(candles) && candles.length) {
    const last = candles[candles.length - 1];
    const price = toNumber(last?.close ?? last?.c);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return 0;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function getAgeHours(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return 0;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function buildMessage(summary) {
  if (!summary.livePrice) return "Live price belum tersedia. Tracker belum bisa mengecek result.";
  if (summary.updatedCount > 0) return `${summary.updatedCount} signal berhasil ditutup otomatis.`;
  if (summary.scanned > 0) return "Semua signal masih berjalan. Belum ada TP/SL yang tersentuh.";
  return "Belum ada signal RUNNING untuk dicek.";
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
  return await res.json();
}

async function fbPut(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
