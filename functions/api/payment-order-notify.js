
const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || env.ADMIN_TELEGRAM_CHAT_ID || "";

  if (!botToken || !chatId) {
    return json({ ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset" }, 200);
  }

  const order = sanitizeOrder(body.order || body || {});
  const appUrl = env.APP_URL || env.VITE_APP_URL || "https://xau-ai-signal.pages.dev";

  const text = [
    "🧾 <b>New Payment Order</b>",
    "",
    `Email: <code>${escapeHtml(order.email)}</code>`,
    `UID: <code>${escapeHtml(order.uid)}</code>`,
    `Paket: <b>${escapeHtml(order.packageLabel)}</b>`,
    `Harga: <b>${escapeHtml(order.price)}</b>`,
    `Status: <b>${escapeHtml(order.status.toUpperCase())}</b>`,
    `Order ID: <code>${escapeHtml(order.orderId)}</code>`,
    "",
    `Buka Admin Panel → Refresh Orders → Approve/Reject`,
    appUrl
  ].join("\n");

  const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const telegramData = await telegramRes.json().catch(() => ({}));

  if (!telegramRes.ok || !telegramData.ok) {
    return json({
      ok: false,
      error: telegramData.description || `Telegram error ${telegramRes.status}`
    }, 200);
  }

  return json({ ok: true, sent: true });
}

function sanitizeOrder(order) {
  return {
    orderId: safe(order.orderId),
    uid: safe(order.uid),
    email: safe(order.email),
    packageLabel: safe(order.packageLabel || order.packageCode || "-"),
    price: safe(order.price || "-"),
    status: safe(order.status || "pending").toLowerCase()
  };
}

function safe(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function escapeHtml(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
