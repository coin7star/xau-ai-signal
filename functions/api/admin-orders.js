
const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";

  if (!adminToken || token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  if (request.method === "GET") {
    const orders = await fbGet(dbUrl, "/paymentOrders") || {};
    const list = Object.values(orders)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100);

    return json({ ok: true, orders: list });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const action = String(body.action || "").toLowerCase();
  const orderId = String(body.orderId || "").trim();

  if (!orderId) return json({ ok: false, error: "orderId wajib diisi" }, 400);

  const order = await fbGet(dbUrl, `/paymentOrders/${orderId}`);
  if (!order) return json({ ok: false, error: "Order tidak ditemukan" }, 404);

  if (action === "reject") {
    const patch = {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fbPatch(dbUrl, `/paymentOrders/${orderId}`, patch);
    const user = await fbGet(dbUrl, `/users/${order.uid}`) || {};

    await fbPatch(dbUrl, `/users/${order.uid}`, {
      lastPaymentStatus: "rejected",
      lastPaymentOrderId: orderId,
      updatedAt: new Date().toISOString()
    });

    const userNotify = await notifyUserOrderStatus({
      env,
      user,
      order: { ...order, ...patch },
      status: "rejected"
    });

    return json({ ok: true, order: { ...order, ...patch }, telegramNotify: userNotify });
  }

  if (action !== "approve") {
    return json({ ok: false, error: "action harus approve atau reject" }, 400);
  }

  const days = Number(body.days || getDaysFromPackage(order.packageCode || order.packageLabel));
  if (!days || days <= 0) return json({ ok: false, error: "Durasi paket tidak valid" }, 400);

  const user = await fbGet(dbUrl, `/users/${order.uid}`) || {};
  const baseTime = user.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now()
    ? new Date(user.premiumUntil)
    : new Date();

  baseTime.setDate(baseTime.getDate() + days);
  const premiumUntil = baseTime.toISOString();
  const now = new Date().toISOString();

  const orderPatch = {
    status: "approved",
    approvedAt: now,
    approvedDays: days,
    premiumUntil,
    updatedAt: now
  };

  await fbPatch(dbUrl, `/paymentOrders/${orderId}`, orderPatch);
  await fbPatch(dbUrl, `/users/${order.uid}`, {
    role: "premium",
    premiumUntil,
    lastPaymentStatus: "approved",
    lastPaymentOrderId: orderId,
    lastPaymentPackage: order.packageLabel || order.packageCode || "",
    lastPaymentPrice: order.price || "",
    updatedAt: now
  });

  const userNotifyApprove = await notifyUserOrderStatus({
    env,
    user,
    order: { ...order, ...orderPatch },
    status: "approved",
    premiumUntil
  });

  return json({ ok: true, order: { ...order, ...orderPatch }, premiumUntil, telegramNotify: userNotifyApprove });
}

function getDaysFromPackage(value) {
  const text = String(value || "").toUpperCase();
  if (text.includes("7")) return 7;
  if (text.includes("30")) return 30;
  return 0;
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed ${res.status}`);
  return await res.json();
}

async function fbPatch(dbUrl, path, patch) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase PATCH failed ${res.status}: ${text}`);
  }

  return await res.json();
}


async function notifyUserOrderStatus({ env, user, order, status, premiumUntil }) {
  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || "";
  const chatId = user?.telegramChatId || user?.telegram_chat_id || "";

  if (!botToken || !chatId) {
    return { ok: false, skipped: true, reason: "telegram-not-connected" };
  }

  const isApproved = status === "approved";
  const title = isApproved ? "✅ Premium Aktif" : "❌ Pembayaran Ditolak";

  const lines = isApproved ? [
    title,
    "",
    `Paket: ${safeText(order.packageLabel || order.packageCode || "-")}`,
    `Order ID: ${safeText(order.orderId || "-")}`,
    `Premium aktif sampai: ${formatTelegramDate(premiumUntil)}`,
    "",
    "Silakan buka dashboard XAU AI Signal untuk mulai menggunakan fitur premium."
  ] : [
    title,
    "",
    `Paket: ${safeText(order.packageLabel || order.packageCode || "-")}`,
    `Order ID: ${safeText(order.orderId || "-")}`,
    "",
    "Pembayaran belum bisa dikonfirmasi. Silakan hubungi admin dan kirim ulang bukti pembayaran jika diperlukan."
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\\n"),
        disable_web_page_preview: true
      })
    });

    const data = await res.json().catch(() => ({}));

    return {
      ok: Boolean(res.ok && data.ok),
      status: res.status,
      description: data.description || ""
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function safeText(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function formatTelegramDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
