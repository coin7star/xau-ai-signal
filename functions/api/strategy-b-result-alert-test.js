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
      error: "Method not allowed. Gunakan tombol SMC AI Result Test dari panel admin."
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

  const enabled = String(env.STRATEGY_B_RESULT_TEST_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return json({ ok: false, error: "SMC AI result alert test sedang dimatikan dari ENV." }, 403);
  }

  const cooldownSec = Math.max(5, Number(env.STRATEGY_B_RESULT_TEST_COOLDOWN_SEC || env.RESULT_ALERT_TEST_COOLDOWN_SEC || env.TELEGRAM_TEST_COOLDOWN_SEC || 20));
  const now = Date.now();
  const diffSec = Math.floor((now - lastTestAt) / 1000);
  if (lastTestAt && diffSec < cooldownSec) {
    return json({
      ok: false,
      error: "SMC AI result alert test sedang cooldown.",
      retryAfterSec: cooldownSec - diffSec
    }, 429);
  }

  const result = normalizeResult(body.result || "WIN");
  if (!result) {
    return json({ ok: false, error: "Result test tidak valid. Pilih WIN, LOSS, atau EXPIRED." }, 400);
  }

  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";
  if (!botToken || !chatId) {
    return json({ ok: false, error: "Telegram gateway belum aktif. Cek TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID." }, 500);
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || "https://www.xauaisignal.online";
  const sample = buildSmcResultSample(result);
  const text = buildSmcResultTelegramMessage(sample, result, dashboardUrl);

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
    return json({ ok: false, error: "Telegram gagal mengirim SMC AI result test alert.", status: res.status, response }, 500);
  }

  lastTestAt = now;

  return json({
    ok: true,
    message: `SMC AI result ${result} test alert berhasil dikirim ke Telegram admin.`,
    result,
    mode: "ADMIN_TEST_ONLY",
    sentAt: new Date(now).toISOString(),
    cooldownSec,
    response
  });
}

function normalizeResult(value) {
  const result = String(value || "").toUpperCase();
  return ["WIN", "LOSS", "EXPIRED"].includes(result) ? result : null;
}

function buildSmcResultSample(result) {
  const base = {
    strategy: "SMC AI",
    trackerType: "STRATEGY B LIVE BACKTEST TEST",
    signal: "BUY",
    pair: "XAUUSD+",
    entry: 4540.20,
    sl: 4536.80,
    tp: 4547.00,
    rr: "1:2",
    confidence: 88,
    ob: "VALID",
    sweep: "YES",
    choch: "YES",
    ema: "YES",
    createdAt: new Date(Date.now() - 46 * 60000).toISOString(),
    closedAt: new Date().toISOString()
  };

  if (result === "WIN") {
    return { ...base, resultPrice: 4547.20, note: "Mode test: contoh notifikasi saat target profit SMC AI berhasil tercapai." };
  }

  if (result === "LOSS") {
    return { ...base, resultPrice: 4536.60, note: "Mode test: contoh notifikasi saat setup SMC AI selesai di area stop loss." };
  }

  return { ...base, resultPrice: 4541.30, note: "Mode test: contoh notifikasi saat setup SMC AI melewati batas waktu tanpa menyentuh TP/SL." };
}

function buildSmcResultTelegramMessage(item, result, dashboardUrl) {
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
      ? "Tetap evaluasi checklist SMC. Fokus ke data live-backtest, bukan satu trade."
      : "Abaikan setup SMC lama dan tunggu rangkaian OB → Sweep → CHOCH → EMA berikutnya.";

  return [
    `<b>${title}</b>`,
    `<i>Strategy B · Live Backtest Only</i>`,
    "",
    `<b>Signal:</b> ${escapeHtml(item.signal)} ${escapeHtml(item.pair)}`,
    `<b>Entry:</b> ${formatPrice(item.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(item.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(item.tp)}`,
    `<b>Result Price:</b> ${formatPrice(item.resultPrice)}`,
    `<b>RR:</b> ${escapeHtml(item.rr)}`,
    `<b>Confidence Awal:</b> ${Number(item.confidence)}%`,
    `<b>Duration:</b> ${escapeHtml(buildDurationText(item.createdAt, item.closedAt))}`,
    "",
    "🧠 <b>SMC Checklist</b>",
    `<b>OB M15:</b> ${escapeHtml(item.ob)}`,
    `<b>Sweep M1:</b> ${escapeHtml(item.sweep)}`,
    `<b>CHOCH M1:</b> ${escapeHtml(item.choch)}`,
    `<b>EMA M1:</b> ${escapeHtml(item.ema)}`,
    "",
    "🎯 <b>Result</b>",
    escapeHtml(resultLine),
    escapeHtml(item.note || ""),
    "",
    "🧭 <b>Action</b>",
    escapeHtml(actionLine),
    "",
    "⚠️ <b>Mode</b>",
    "Ini hanya test result alert admin. History asli tidak diubah dan belum dikirim ke user premium.",
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`
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
