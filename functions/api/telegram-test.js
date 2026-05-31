const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-test-token"
};

const cooldownStore = globalThis.__xauTelegramTestCooldown || new Map();
globalThis.__xauTelegramTestCooldown = cooldownStore;

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: H });
  }

  if (request.method !== "POST") {
    return json({
      ok: false,
      error: "Method not allowed. Gunakan tombol Test Telegram Alert dari panel admin."
    }, 405);
  }

  const authToken = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  const secretToken = request.headers.get("x-admin-test-token") || "";
  const expectedAdminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  const expectedTestSecret = env.TELEGRAM_TEST_SECRET || "";

  const allowedByAdmin = Boolean(expectedAdminToken && authToken && authToken === expectedAdminToken);
  const allowedBySecret = Boolean(expectedTestSecret && secretToken && secretToken === expectedTestSecret);

  if (!allowedByAdmin && !allowedBySecret) {
    return json({
      ok: false,
      error: "Unauthorized. Test alert hanya bisa dijalankan dari akses admin."
    }, 401);
  }

  const cooldownSec = Math.max(10, Number(env.TELEGRAM_TEST_COOLDOWN_SEC || 30));
  const cooldownKey = allowedByAdmin ? `admin:${authToken.slice(-8)}` : `secret:${secretToken.slice(-8)}`;
  const now = Date.now();
  const lastSentAt = Number(cooldownStore.get(cooldownKey) || 0);
  const waitMs = cooldownSec * 1000 - (now - lastSentAt);

  if (waitMs > 0) {
    return json({
      ok: false,
      error: "Test alert masih cooldown. Coba lagi sebentar lagi.",
      cooldownSec,
      retryAfterSec: Math.ceil(waitMs / 1000)
    }, 429, { "Retry-After": String(Math.ceil(waitMs / 1000)) });
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({
      ok: false,
      error: "Premium alert gateway belum aktif. Cek TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di Cloudflare ENV."
    }, 500);
  }

  const dashboardUrl = env.PUBLIC_DASHBOARD_URL || "https://www.xauaisignal.online";
  const text = [
    "🟢 <b>XAU AI PREMIUM ALERT TEST</b>",
    "<i>Premium notification gateway sudah aktif.</i>",
    "",
    "<b>Signal:</b> TEST MODE",
    "<b>Pair:</b> XAUUSD+",
    "<b>Confidence:</b> 100% · Gateway Check",
    "",
    "🚀 <b>Status</b>",
    "Premium alert channel siap menerima MAIN CALL berikutnya.",
    "",
    `Dashboard: ${dashboardUrl}`,
    "",
    "<i>Bukan financial advice.</i>"
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
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

  if (res.ok) cooldownStore.set(cooldownKey, now);

  return json({
    ok: res.ok,
    status: res.status,
    message: res.ok ? "Test alert premium berhasil dikirim." : "Telegram gateway menolak request.",
    response
  }, res.ok ? 200 : 500);
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, ...extraHeaders }
  });
}
