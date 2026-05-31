const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const cooldownSec = Math.max(10, Number(env.TELEGRAM_BROADCAST_COOLDOWN_SEC || 60));

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);
  if (!botToken) return json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diset" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const text = String(body.text || "").trim();
  const target = String(body.target || "premium_connected").trim();

  if (!text || text.length < 3) {
    return json({ ok: false, error: "Isi broadcast minimal 3 karakter" }, 400);
  }

  if (text.length > 900) {
    return json({ ok: false, error: "Broadcast maksimal 900 karakter agar tetap nyaman dibaca." }, 400);
  }

  const guard = await fbGet(dbUrl, "/xauusd/telegram/broadcastGuard/latest");
  const lastSentAt = guard?.sentAt ? new Date(guard.sentAt).getTime() : 0;
  const waitMs = cooldownSec * 1000 - (Date.now() - lastSentAt);
  if (lastSentAt && waitMs > 0) {
    return json({
      ok: false,
      error: `Broadcast cooldown aktif. Coba lagi sekitar ${Math.ceil(waitMs / 1000)} detik.`,
      cooldownSec,
      retryAfterSec: Math.ceil(waitMs / 1000)
    }, 429);
  }

  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {}).filter(Boolean);

  let recipients = users.filter((user) => {
    if (!user.telegramConnected || !user.telegramChatId) return false;

    if (target === "all_connected") return true;
    if (target === "admin_connected") return user.role === "admin";
    return isPremium(user);
  });

  const seen = new Set();
  recipients = recipients.filter((user) => {
    const chatId = String(user.telegramChatId || "");
    if (!chatId || seen.has(chatId)) return false;
    seen.add(chatId);
    return true;
  });

  const finalText = [
    "📣 <b>XAU AI Signal · Official Broadcast</b>",
    "",
    escapeHtml(text),
    "",
    "<i>Official update dari XAU AI Signal.</i>"
  ].join("\n");

  const results = [];

  for (const user of recipients) {
    const sent = await sendTelegram(botToken, String(user.telegramChatId), finalText);
    results.push({
      uid: user.uid || null,
      email: user.email || null,
      chatId: maskChatId(user.telegramChatId),
      ok: sent.ok,
      status: sent.status
    });
  }

  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;
  const logId = safeKey(new Date().toISOString());

  const sentAt = new Date().toISOString();

  await fbPut(dbUrl, `/xauusd/telegram/broadcastLogs/${logId}`, {
    text,
    target,
    totalRecipients: results.length,
    successCount,
    failedCount,
    results,
    createdAt: sentAt,
    manualBroadcast: true
  });

  await fbPut(dbUrl, "/xauusd/telegram/broadcastGuard/latest", {
    sentAt,
    target,
    totalRecipients: results.length,
    successCount,
    failedCount,
    cooldownSec
  });

  return json({
    ok: successCount > 0 || recipients.length === 0,
    target,
    totalRecipients: results.length,
    successCount,
    failedCount,
    results
  });
}

function isPremium(user) {
  if (!user) return false;
  if (user.status && user.status !== "active") return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  const until = user.premiumUntil || user.expiredAt || null;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

async function sendTelegram(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
    try {
      response = await res.json();
    } catch {
      response = await res.text();
    }

    return {
      ok: res.ok,
      status: res.status,
      response
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: String(err?.message || err)
    };
  }
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function maskChatId(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function safeKey(value) {
  return String(value || "empty")
    .replaceAll(".", "_")
    .replaceAll("#", "_")
    .replaceAll("$", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_")
    .replaceAll("/", "_")
    .replaceAll(":", "_");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
