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
      error: "Method not allowed. Gunakan tombol Test Result Alert dari panel admin."
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

  const cooldownSec = Math.max(5, Number(env.RESULT_ALERT_TEST_COOLDOWN_SEC || env.TELEGRAM_TEST_COOLDOWN_SEC || 20));
  const now = Date.now();
  const diffSec = Math.floor((now - lastTestAt) / 1000);
  if (lastTestAt && diffSec < cooldownSec) {
    return json({
      ok: false,
      error: "Test result alert sedang cooldown.",
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
  const sample = buildSampleSignal(result);
  const text = buildResultTelegramMessage(sample, result, dashboardUrl);

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
    return json({ ok: false, error: "Telegram gagal mengirim test result alert.", status: res.status, response }, 500);
  }

  lastTestAt = now;

  return json({
    ok: true,
    message: `Test result alert ${result} berhasil dikirim ke Telegram.`,
    result,
    sentAt: new Date(now).toISOString(),
    cooldownSec,
    response
  });
}

function normalizeResult(value) {
  const result = String(value || "").toUpperCase();
  return ["WIN", "LOSS", "EXPIRED"].includes(result) ? result : null;
}

function buildSampleSignal(result) {
  const base = {
    trackerType: "MAIN CALL TEST",
    signal: "BUY",
    pair: "XAUUSD+",
    entry: 4540.00,
    sl: 4537.00,
    tp: 4545.00,
    confidence: 82,
    createdAt: new Date(Date.now() - 38 * 60000).toISOString(),
    closedAt: new Date().toISOString()
  };

  if (result === "WIN") {
    return { ...base, resultPrice: 4545.20, note: "Mode test: contoh notifikasi saat target profit berhasil tercapai." };
  }

  if (result === "LOSS") {
    return { ...base, resultPrice: 4536.90, note: "Mode test: contoh notifikasi saat setup selesai di area stop loss." };
  }

  return { ...base, resultPrice: 4541.10, note: "Mode test: contoh notifikasi saat setup melewati batas waktu tanpa menyentuh TP/SL." };
}

function buildResultTelegramMessage(item, result, dashboardUrl) {
  const signal = String(item.signal || "-").toUpperCase();
  const pair = escapeHtml(item.pair || item.symbol || "XAUUSD+");
  const type = escapeHtml(String(item.trackerType || "MAIN CALL TEST").replace(/_/g, " "));
  const confidenceText = Number.isFinite(Number(item.confidence)) ? `${Number(item.confidence)}%` : "-";
  const durationText = buildDurationText(item.createdAt, item.closedAt);
  const title = result === "WIN"
    ? "✅ XAU AI RESULT TEST · WIN"
    : result === "LOSS"
      ? "❌ XAU AI RESULT TEST · LOSS"
      : "⚪ XAU AI RESULT TEST · EXPIRED";

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
    `<i>Mode test untuk memastikan format result alert Telegram sudah siap.</i>`,
    "",
    `<b>Signal:</b> ${escapeHtml(signal)} ${pair}`,
    `<b>Type:</b> ${type}`,
    `<b>Entry:</b> ${formatPrice(item.entry)}`,
    `<b>Stop Loss:</b> ${formatPrice(item.sl)}`,
    `<b>Take Profit:</b> ${formatPrice(item.tp)}`,
    `<b>Result Price:</b> ${formatPrice(item.resultPrice)}`,
    `<b>Confidence Awal:</b> ${escapeHtml(confidenceText)}`,
    `<b>Duration:</b> ${escapeHtml(durationText)}`,
    "",
    "🎯 <b>Result</b>",
    escapeHtml(resultLine),
    escapeHtml(item.note || ""),
    "",
    "🧠 <b>Action</b>",
    escapeHtml(actionLine),
    "",
    `🚀 <b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    "<i>Ini hanya test alert. History asli tidak diubah.</i>"
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
    .replace(/"/g, "&quot;");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
