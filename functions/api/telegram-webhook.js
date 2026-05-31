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
      mode: "miniapp-first-connect"
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
  const [commandRaw, ...args] = text.split(/\s+/);
  const command = String(commandRaw || "").toLowerCase();

  let replyText = "";
  let replyMarkup = buildDashboardKeyboard(env);

  if (command === "/start") {
    replyText = buildStartMessage();
  } else if (command === "/connect") {
    replyText = await handleConnect(env, message, args);
  } else if (command === "/disconnect") {
    replyText = await handleDisconnect(env, message);
  } else if (command === "/me") {
    replyText = await handleMe(env, message);
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
    mode: "miniapp-first-connect"
  });
}

async function handleConnect(env, message, args) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return "❌ Live Data Engine belum aktif. Silakan cek konfigurasi server.";

  const code = String(args[0] || "").trim().toUpperCase();

  if (!code || !code.startsWith("XAU-")) {
    return [
      "🔗 <b>Connect Telegram</b>",
      "",
      "Format:",
      "<code>/connect XAU-123456</code>",
      "",
      "Ambil kode dari dashboard premium kamu:",
      "Dashboard → Telegram Premium → Generate Connect Code → Copy Command.",
      "",
      "⚠️ Jangan share kode connect. Kode aktif 15 menit dan sekali pakai."
    ].join("\n");
  }

  const record = await fbGet(dbUrl, `/telegramConnectCodes/${code}`);

  if (!record || record.used) {
    return "❌ Kode tidak ditemukan atau sudah dipakai. Generate kode baru dari dashboard.";
  }

  if (Date.now() > new Date(record.expiresAt).getTime()) {
    return "⏰ Kode sudah expired. Generate kode baru dari dashboard.";
  }

  const user = await fbGet(dbUrl, `/users/${record.uid}`);

  if (!user) {
    return "❌ User tidak ditemukan.";
  }

  if (!isPremium(user)) {
    return "🔒 Akun ini belum premium aktif. Aktifkan premium dulu baru connect Telegram.";
  }

  const now = new Date().toISOString();
  const chat = message.chat || {};
  const from = message.from || {};

  await fbPatch(dbUrl, `/users/${record.uid}`, {
    telegramConnected: true,
    telegramChatId: String(chat.id),
    telegramUsername: from.username || chat.username || "",
    telegramFirstName: from.first_name || chat.first_name || "",
    telegramConnectedAt: now,
    telegramAlertEnabled: true,
    telegramAlertMainSignal: true,
    telegramAlertResult: true,
    telegramAlertUpdatedAt: now,
    telegramConnectCode: null,
    telegramConnectExpiresAt: null,
    updatedAt: now
  });

  await fbPatch(dbUrl, `/telegramConnectCodes/${code}`, {
    used: true,
    usedAt: now,
    chatId: String(chat.id)
  });

  return [
    "✅ <b>Telegram Connected</b>",
    "",
    `Akun: <b>${escapeHtml(user.email || "-")}</b>`,
    `Role: <b>${escapeHtml(user.role || "-")}</b>`,
    "",
    "Mulai sekarang akun ini sudah terhubung ke Telegram.",
    "Main Signal Alert: ON otomatis.",
    "Result Alert: ON otomatis.",
    "Kalau ingin berhenti menerima sinyal/result, matikan dari dashboard Telegram panel."
  ].join("\n");
}

async function handleDisconnect(env, message) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return "❌ Live Data Engine belum aktif. Silakan cek konfigurasi server.";

  const chatId = String(message.chat?.id || "");
  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {});
  const user = users.find((item) => String(item.telegramChatId || "") === chatId);

  if (!user?.uid) {
    return "ℹ️ Telegram ini belum connect ke akun XAU AI mana pun.";
  }

  await fbPatch(dbUrl, `/users/${user.uid}`, {
    telegramConnected: false,
    telegramChatId: null,
    telegramUsername: null,
    telegramFirstName: null,
    telegramConnectedAt: null,
    telegramAlertEnabled: false,
    telegramAlertMainSignal: false,
    telegramAlertResult: false,
    telegramAlertUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return "✅ Telegram berhasil disconnect dari akun XAU AI.";
}

async function handleMe(env, message) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return "❌ Live Data Engine belum aktif. Silakan cek konfigurasi server.";

  const chatId = String(message.chat?.id || "");
  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {});
  const user = users.find((item) => String(item.telegramChatId || "") === chatId);

  if (!user) {
    return [
      "👤 <b>Telegram Status</b>",
      "",
      "Belum terhubung ke akun XAU AI.",
      "Buka dashboard, generate kode, lalu kirim:",
      "<code>/connect XAU-123456</code>"
    ].join("\n");
  }

  return [
    "👤 <b>Telegram Status</b>",
    "",
    `Email: <b>${escapeHtml(user.email || "-")}</b>`,
    `Role: <b>${escapeHtml(user.role || "-")}</b>`,
    `Premium until: <b>${escapeHtml(user.premiumUntil || "-")}</b>`,
    `Connected: <b>${user.telegramConnected ? "YES" : "NO"}</b>`
  ].join("\n");
}

function buildStartMessage() {
  return [
    "🚀 <b>XAU AI Signal</b>",
    "",
    "Akses utama sekarang lewat Mini App agar pengalaman trading lebih rapi dan premium.",
    "Klik tombol di bawah buat buka dashboard:",
    "",
    "• MAIN CALL Signal",
    "• M1 Scalp Radar",
    "• Fresh OB M15",
    "• CALL History",
    "• Telegram Connect",
    "",
    "<b>Cara Connect Telegram:</b>",
    "1. Login dashboard pakai akun premium/admin.",
    "2. Buka menu <b>Telegram Premium</b>.",
    "3. Klik <b>Generate Connect Code</b>.",
    "4. Klik <b>Copy Command</b>.",
    "5. Paste command ke bot ini, contoh:",
    "<code>/connect XAU-123456</code>",
    "6. Balik dashboard lalu klik <b>Refresh Status</b>.",
    "",
    "⚠️ Jangan share kode connect. Siapa pun yang pakai kode bisa connect ke akun kamu.",
    "",
    "<i>Main signal alert tetap aktif. Personal premium alert akan mengikuti koneksi akun kamu.</i>"
  ].join("\n");
}

function buildHelpMessage() {
  return [
    "📌 <b>Panduan XAU AI Signal</b>",
    "",
    "<b>Command aktif:</b>",
    "/start - buka dashboard Mini App",
    "/connect KODE - hubungkan Telegram ke akun premium",
    "/disconnect - putuskan Telegram dari akun",
    "/me - cek koneksi Telegram",
    "/status - cek status layanan",
    "/help - panduan penggunaan",
    "",
    "<b>Dashboard Mini App:</b>",
    "Gunakan tombol di bawah untuk melihat signal, chart, history, dan radar market.",
    "",
    "<i>Demo first. XAUUSD galak, risk management wajib.</i>"
  ].join("\n");
}

function buildMovedToDashboardMessage(command) {
  return [
    "📲 <b>Fitur ini sekarang ada di Dashboard</b>",
    "",
    `Command <b>${escapeHtml(command)}</b> sudah dipindahkan ke Mini App.`,
    "Fitur ini dipindahkan agar pengalaman trading lebih lengkap dan rapi.",
    "",
    "Klik tombol di bawah buat buka dashboard."
  ].join("\n");
}

async function buildStatusMessage(env) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const hasTelegram = Boolean(env.TELEGRAM_BOT_TOKEN);
  const dashboardUrl = env.DASHBOARD_URL || "https://xau-ai-signal.pages.dev";

  let liveEngineStatus = "Checking";

  if (dbUrl) {
    try {
      const raw = await fbGet(dbUrl, "/xauusd/latest");
      liveEngineStatus = raw ? "Online" : "Waiting Market Feed";
    } catch {
      liveEngineStatus = "Temporary Check Failed";
    }
  } else {
    liveEngineStatus = "Setup Required";
  }

  return [
    "🟢 <b>XAU AI Premium Status</b>",
    "",
    `<b>Bot Gateway:</b> ${hasTelegram ? "Online" : "Setup Required"}`,
    `<b>Live Data Engine:</b> ${escapeHtml(liveEngineStatus)}`,
    `<b>Premium Dashboard:</b> ${escapeHtml(dashboardUrl)}`,
    "",
    "<b>Access Mode:</b> Mini App + Secure Telegram Connect",
    "<b>Main Signal Alert:</b> Active"
  ].join("\n");
}

function buildDashboardKeyboard(env) {
  const url = env.DASHBOARD_URL || "https://xau-ai-signal.pages.dev";

  return {
    inline_keyboard: [
      [
        {
          text: "🚀 Open Premium Dashboard",
          web_app: { url }
        }
      ]
    ]
  };
}

function isPremium(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  if (!user.premiumUntil && !user.expiredAt) return false;
  return new Date(user.premiumUntil || user.expiredAt).getTime() > Date.now();
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

  if (replyMarkup) payload.reply_markup = replyMarkup;

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

async function fbPatch(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
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
