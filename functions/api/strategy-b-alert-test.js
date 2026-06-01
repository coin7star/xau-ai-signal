const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-test-token"
};

let lastTestAt = 0;

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  if (request.method !== "POST") {
    return json({
      ok: false,
      error: "Method not allowed. Gunakan tombol SMC AI Alert Test dari panel admin."
    }, 405);
  }

  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  const providedToken = body.token
    || request.headers.get("Authorization")?.replace("Bearer ", "")
    || request.headers.get("x-admin-test-token")
    || "";

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const testSecret = env.TELEGRAM_TEST_SECRET || "";
  const authorized = Boolean(
    (adminToken && providedToken === adminToken) ||
    (testSecret && providedToken === testSecret)
  );

  if (!authorized) {
    return json({ ok: false, error: "Kode admin tidak valid." }, 401);
  }

  const enabled = String(env.STRATEGY_B_TELEGRAM_TEST_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return json({ ok: false, error: "SMC AI Telegram test sedang dimatikan dari ENV." }, 403);
  }

  const cooldownSec = Math.max(5, Number(env.STRATEGY_B_ALERT_TEST_COOLDOWN_SEC || env.TELEGRAM_TEST_COOLDOWN_SEC || 20));
  const now = Date.now();
  const diffSec = Math.floor((now - lastTestAt) / 1000);
  if (lastTestAt && diffSec < cooldownSec) {
    return json({
      ok: false,
      error: "SMC AI alert test sedang cooldown.",
      retryAfterSec: cooldownSec - diffSec
    }, 429);
  }

  const direction = normalizeDirection(body.direction || "BUY");
  if (!direction) {
    return json({ ok: false, error: "Direction tidak valid. Pilih BUY atau SELL." }, 400);
  }

  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";
  if (!botToken || !chatId) {
    return json({ ok: false, error: "Telegram gateway belum aktif. Cek TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID." }, 500);
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || "https://www.xauaisignal.online";
  const sample = buildSmcSample(direction);
  const text = buildSmcTelegramMessage(sample, dashboardUrl);

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
          { text: "🧪 Open Strategy Lab", url: dashboardUrl }
        ]]
      }
    })
  });

  let response = null;
  try { response = await res.json(); } catch { response = await res.text(); }

  if (!res.ok) {
    return json({ ok: false, error: "Telegram gagal mengirim SMC AI test alert.", status: res.status, response }, 500);
  }

  lastTestAt = now;

  return json({
    ok: true,
    message: `SMC AI ${direction} test alert berhasil dikirim ke Telegram admin.`,
    direction,
    mode: "ADMIN_TEST_ONLY",
    sentAt: new Date(now).toISOString(),
    cooldownSec,
    response
  });
}

function normalizeDirection(value) {
  const direction = String(value || "").toUpperCase();
  return ["BUY", "SELL"].includes(direction) ? direction : null;
}

function buildSmcSample(direction) {
  if (direction === "SELL") {
    return {
      direction,
      entry: 4541.20,
      sl: 4544.10,
      tp: 4535.40,
      rr: "1:2",
      confidence: 88,
      ob: "VALID",
      sweep: "YES",
      choch: "YES",
      ema: "YES",
      rsi: 42.10,
      mfi: 39.40,
      reason: "Fresh Bearish OB M15 valid, Sweep High M1 terdeteksi, CHOCH bearish valid, dan EMA 9/20 M1 mendukung SELL."
    };
  }

  return {
    direction,
    entry: 4540.20,
    sl: 4536.80,
    tp: 4547.00,
    rr: "1:2",
    confidence: 88,
    ob: "VALID",
    sweep: "YES",
    choch: "YES",
    ema: "YES",
    rsi: 58.30,
    mfi: 61.20,
    reason: "Fresh Bullish OB M15 valid, Sweep Low M1 terdeteksi, CHOCH bullish valid, dan EMA 9/20 M1 mendukung BUY."
  };
}

function buildSmcTelegramMessage(setup, dashboardUrl) {
  const isBuy = setup.direction === "BUY";
  const title = isBuy ? "🟢 SMC AI BUY · TEST MODE" : "🔴 SMC AI SELL · TEST MODE";

  return [
    `<b>${title}</b>`,
    `<i>Strategy B · Live Backtest Only</i>`,
    "",
    `<b>Entry:</b> ${formatPrice(setup.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(setup.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(setup.tp)}`,
    `<b>RR:</b> ${escapeHtml(setup.rr)}`,
    "",
    "🧠 <b>SMC Checklist</b>",
    `<b>OB M15:</b> ${escapeHtml(setup.ob)}`,
    `<b>Sweep M1:</b> ${escapeHtml(setup.sweep)}`,
    `<b>CHOCH M1:</b> ${escapeHtml(setup.choch)}`,
    `<b>EMA M1:</b> ${escapeHtml(setup.ema)}`,
    "",
    `<b>Confidence:</b> ${Number(setup.confidence)}%`,
    `<b>RSI:</b> ${formatPrice(setup.rsi)} · <b>MFI:</b> ${formatPrice(setup.mfi)}`,
    "",
    "📌 <b>Reason</b>",
    escapeHtml(setup.reason),
    "",
    "⚠️ <b>Mode</b>",
    "Ini hanya test alert admin. SMC AI belum menjadi sinyal utama dan belum dikirim ke user premium.",
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`
  ].join("\n");
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
