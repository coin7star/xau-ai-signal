
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
    await fbPatch(dbUrl, `/users/${order.uid}`, {
      lastPaymentStatus: "rejected",
      lastPaymentOrderId: orderId,
      updatedAt: new Date().toISOString()
    });

    return json({ ok: true, order: { ...order, ...patch } });
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

  return json({ ok: true, order: { ...order, ...orderPatch }, premiumUntil });
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
