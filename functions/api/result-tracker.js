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
  const [callRaw] = await Promise.all([
    fbGet(dbUrl, "/xauusd/callHistory")
  ]);

  const callItems = Object.values(callRaw || {}).filter(Boolean);

  const allOpen = [
    ...callItems.map((item) => ({ ...item, trackerType: "MAIN_CALL", path: "/xauusd/callHistory", expireHours: mainExpireHours, telegramResultAlert: controls.mainSignalResultAlert !== false }))
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

    if (shouldUpdate && (result.result || result.status) && item.id) {
      const closedAt = new Date().toISOString();
      const payload = {
        ...item,
        ...(result.patch || {}),
        status: result.status || "CLOSED",
        result: result.result,
        closedAt: result.result ? closedAt : null,
        resultPrice: livePrice,
        resultSource: "AUTO_RESULT_ENGINE",
        resultCheckedAt: closedAt,
        triggeredAt: result.triggeredAt || item.triggeredAt || null,
        note: result.note
      };

      delete payload.path;
      delete payload.expireHours;
      delete payload.trackerType;

      const alertResult = result.result && item.telegramResultAlert
        ? await maybeSendResultAlert(env, item, payload, result.result, livePrice, result.note)
        : { sent: false, skippedReason: result.result ? "RESULT_ALERT_DISABLED_FOR_TRACKER" : "PENDING_TRIGGER_ONLY" };

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
    checkedAt: new Date().toISOString(),
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
  const tp1 = toNumber(item.tp1);
  const entry = toNumber(item.entry);
  const status = String(item.status || "OPEN").toUpperCase();

  if (!Number.isFinite(livePrice) || livePrice <= 0) {
    return { result: null, note: "Harga live belum tersedia." };
  }

  if (!Number.isFinite(sl) || !Number.isFinite(tp)) {
    return { result: null, note: "SL/TP belum lengkap." };
  }

  if (status === "PENDING") {
    const directEntry = isMainDirectEntry(item);
    if (directEntry) {
      return {
        result: null,
        status: "OPEN",
        patch: {
          entryTriggered: true,
          triggeredAt: item.triggeredAt || item.createdAt || new Date().toISOString(),
          note: item.note || "Sinyal lama direct entry diperbaiki dari status pending ke berjalan. Tetap dipantau sampai TP/SL/BE."
        },
        note: "Sinyal direct entry aktif. Dipantau sampai TP/SL/BE, bukan di-expire karena muncul sinyal baru."
      };
    }

    if (!Number.isFinite(entry)) return { result: null, note: "Entry limit belum lengkap." };
    const buyTriggered = signal === "BUY" && livePrice <= entry;
    const sellTriggered = signal === "SELL" && livePrice >= entry;

    if (!buyTriggered && !sellTriggered) {
      const ageHoursPending = getAgeHours(item.createdAt || item.candleTime || item.serverTime);
      const expireHoursPending = Number(item.expireHours || 4);
      if (ageHoursPending >= expireHoursPending) {
        return { result: "EXPIRED", note: `Pending limit melewati batas waktu ${expireHoursPending} jam tanpa tersentuh.` };
      }
      return { result: null, note: "Pending limit belum tersentuh." };
    }

    return {
      result: null,
      status: "OPEN",
      triggeredAt: new Date().toISOString(),
      note: `Pending limit tersentuh di sekitar harga ${formatPrice(livePrice)}. Mulai dipantau TP/SL.`
    };
  }

  if (signal === "BUY") {
    if (Number.isFinite(tp1) && !item.tp1Hit && livePrice >= tp1) {
      return {
        result: null,
        status: "OPEN",
        patch: {
          tp1Hit: true,
          tp1HitAt: new Date().toISOString(),
          breakEvenActive: true,
          originalSl: item.originalSl || sl,
          sl: entry
        },
        note: `TP1 tercapai di harga ${formatPrice(livePrice)}. SL dipindahkan ke BE ${formatPrice(entry)}.`
      };
    }
    if (livePrice >= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (item.breakEvenActive && livePrice <= entry) return { result: "BE", note: `Harga kembali ke BE ${formatPrice(entry)} setelah TP1.` };
    if (livePrice <= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  if (signal === "SELL") {
    if (Number.isFinite(tp1) && !item.tp1Hit && livePrice <= tp1) {
      return {
        result: null,
        status: "OPEN",
        patch: {
          tp1Hit: true,
          tp1HitAt: new Date().toISOString(),
          breakEvenActive: true,
          originalSl: item.originalSl || sl,
          sl: entry
        },
        note: `TP1 tercapai di harga ${formatPrice(livePrice)}. SL dipindahkan ke BE ${formatPrice(entry)}.`
      };
    }
    if (livePrice <= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (item.breakEvenActive && livePrice >= entry) return { result: "BE", note: `Harga kembali ke BE ${formatPrice(entry)} setelah TP1.` };
    if (livePrice >= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  const ageHours = getAgeHours(item.createdAt || item.candleTime || item.serverTime);
  const expireHours = Number(item.expireHours || 24);
  if (ageHours >= expireHours) {
    return { result: "EXPIRED", note: `Signal melewati batas waktu ${expireHours} jam tanpa menyentuh TP/SL.` };
  }

  return { result: null, note: "Masih berjalan. Belum menyentuh TP/SL." };
}

function isMainDirectEntry(item = {}) {
  const type = String(item.type || "").toUpperCase();
  const mode = String(item.mode || item.strategySnapshot?.mainM5?.mode || "").toUpperCase();
  const action = String(item.action || item.strategySnapshot?.mainM5?.action || "").toUpperCase();
  const entryMethod = String(item.entryMethod || item.strategySnapshot?.mainM5?.entryMethod || "").toUpperCase();
  const directFlag = item.entryTriggered === true || item.strategySnapshot?.mainM5?.candleBreak?.directCrossEntry === true;

  return (
    type.includes("MAIN_M1_EMA_CROSS_DIRECT") ||
    mode.includes("M1_EMA_CROSS_DIRECT") ||
    action === "BUY_OPEN" ||
    action === "SELL_OPEN" ||
    entryMethod.includes("OPEN_MARKET_AFTER_M1") ||
    directFlag
  );
}

function isOpen(item) {
  const status = String(item?.status || "OPEN").toUpperCase();
  const result = String(item?.result || "").toUpperCase();
  return status !== "CLOSED" && !["WIN", "LOSS", "BE", "EXPIRED"].includes(result);
}

function getMarketPrice(market) {
  // MT5/VPS sender di broker bisa memakai nama field berbeda-beda.
  // Dashboard sudah bisa membaca lastClose/bid/ask, jadi tracker juga wajib membaca field yang sama
  // supaya auto result tidak bilang live price kosong saat harga sebenarnya tersedia.
  const direct = firstValidNumber(
    market?.lastPrice,
    market?.price,
    market?.lastClose,
    market?.close,
    market?.bid,
    market?.ask,
    market?.latest?.lastPrice,
    market?.latest?.price,
    market?.latest?.lastClose,
    market?.latest?.bid,
    market?.latest?.ask,
    market?.ticker?.lastPrice,
    market?.ticker?.price,
    market?.ticker?.bid,
    market?.ticker?.ask,
    market?.m1?.lastPrice,
    market?.m1?.price,
    market?.m1?.lastClose,
    market?.m1?.bid,
    market?.m1?.ask
  );
  if (Number.isFinite(direct) && direct > 0) return direct;

  const candles = market?.m1 || market?.candles?.m1 || market?.candlesM1 || [];
  if (Array.isArray(candles) && candles.length) {
    const last = candles[candles.length - 1];
    const price = firstValidNumber(last?.close, last?.c, last?.lastClose, last?.bid, last?.ask);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return 0;
}

function firstValidNumber(...values) {
  for (const value of values) {
    const n = toNumber(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
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
