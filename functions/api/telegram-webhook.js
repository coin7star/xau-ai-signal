const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json({
      ok: true,
      message: "Telegram webhook ready. Use POST only.",
      mode: "miniapp-first"
    });
  }

  let update;

  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid Telegram update JSON" }, 400);
  }

  const message = update.message || update.edited_message || null;
  const chatId = message?.chat?.id;

  if (!chatId) {
    return json({ ok: true, skipped: "no-chat-id" });
  }

  const text = String(message?.text || "").trim();
  const command = text.split(" ")[0].toLowerCase();

  let replyText = "";
  const replyMarkup = buildDashboardKeyboard(env);

  if (command === "/start") {
    replyText = buildStartMessage();
  } else if (command === "/status") {
    replyText = await buildStatusMessage(env);
  } else if (command === "/help") {
    replyText = buildHelpMessage();
  } else if (["/signal", "/history", "/scalp_history", "/scalphistory"].includes(command)) {
    replyText = buildMovedToDashboardMessage(command);
  } else {
    replyText = buildHelpMessage();
  }

  await sendTelegramMessage(env, chatId, replyText, replyMarkup);

  return json({
    ok: true,
    handled: command || "text",
    mode: "miniapp-first"
  });
}

function buildStartMessage() {
  return [
    "🚀 <b>XAU AI Signal</b>",
    "",
    "Dashboard sekarang lewat Mini App biar lebih rapi dan hemat.",
    "Klik tombol di bawah buat buka dashboard:",
    "",
    "• MAIN CALL Signal",
    "• M1 Scalp Radar",
    "• Fresh OB M15",
    "• CALL History",
    "• SCALP Valid History",
    "",
    "<i>Auto alert MAIN CALL tetap masuk ke chat ini.</i>"
  ].join("\n");
}

function buildHelpMessage() {
  return [
    "📌 <b>Panduan XAU AI Signal</b>",
    "",
    "<b>Command aktif:</b>",
    "/start - buka dashboard Mini App",
    "/status - cek koneksi bot",
    "/help - panduan penggunaan",
    "",
    "<b>Dashboard Mini App:</b>",
    "Gunakan tombol di bawah untuk melihat signal, chart, history, dan scalp radar.",
    "",
    "<b>Catatan:</b>",
    "Command /signal, /history, dan /scalp_history sudah dipindahkan ke dashboard supaya bot tidak spam dan Firebase lebih hemat.",
    "",
    "<i>Demo first. XAUUSD galak, risk management wajib.</i>"
  ].join("\n");
}

function buildMovedToDashboardMessage(command) {
  return [
    "📲 <b>Fitur ini sekarang ada di Dashboard</b>",
    "",
    `Command <b>${escapeHtml(command)}</b> sudah dipindahkan ke Mini App.`,
    "Ini dibuat biar tampilan lebih lengkap dan Firebase lebih hemat.",
    "",
    "Klik tombol di bawah buat buka dashboard."
  ].join("\n");
}

async function buildStatusMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const hasTelegram = Boolean(env.TELEGRAM_BOT_TOKEN);
  const dashboardUrl = env.DASHBOARD_URL || "https://xau-ai-signal.pages.dev";

  let firebaseStatus = "belum dicek";

  if (dbUrl) {
    try {
      const raw = await fbGet(dbUrl, "/xauusd/latest");
      firebaseStatus = raw ? "online" : "waiting MT5 data";
    } catch {
      firebaseStatus = "error saat cek Firebase";
    }
  } else {
    firebaseStatus = "FIREBASE_DATABASE_URL belum diset";
  }

  return [
    "🟢 <b>XAU AI Bot Status</b>",
    "",
    `<b>Telegram token:</b> ${hasTelegram ? "OK" : "belum diset"}`,
    `<b>Firebase:</b> ${escapeHtml(firebaseStatus)}`,
    `<b>Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    "<b>Mode:</b> Mini App First",
    "<b>Auto Alert:</b> MAIN CALL tetap aktif",
    "",
    "<i>Command data panjang sudah diarahkan ke dashboard.</i>"
  ].join("\n");
}

function buildDashboardKeyboard(env) {
  const url = env.DASHBOARD_URL || "https://xau-ai-signal.pages.dev";

  return {
    inline_keyboard: [
      [
        {
          text: "🚀 Open XAU AI Dashboard",
          web_app: { url }
        }
      ]
    ]
  };
}

async function sendTelegramMessage(env, chatId, text, replyMarkup = null) {
  const token = env.TELEGRAM_BOT_TOKEN || "";

  if (!token || !chatId) return;

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });

  if (!res.ok) return null;

  return await res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store"
    }
  });
}
