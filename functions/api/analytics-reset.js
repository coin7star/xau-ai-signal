const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  if (request.method === "GET") {
    const data = await fbGet(dbUrl, "/xauusd/analyticsReset");
    return json({ ok: true, analyticsReset: normalizeReset(data) }, 200);
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const kind = String(body.kind || "limit").toLowerCase();
  const now = new Date().toISOString();
  const existing = normalizeReset(await fbGet(dbUrl, "/xauusd/analyticsReset"));
  const next = {
    ...existing,
    updatedAt: now,
    updatedBy: "admin"
  };

  if (kind === "limit") {
    next.limitStartAt = now;
    next.limitResetAt = now;
    next.lastAction = "RESET_LIMIT_ANALYTICS";
  } else if (kind === "all") {
    next.allStartAt = now;
    next.limitStartAt = now;
    next.allResetAt = now;
    next.limitResetAt = now;
    next.lastAction = "RESET_ALL_ANALYTICS";
  } else if (kind === "clear") {
    next.allStartAt = null;
    next.limitStartAt = null;
    next.lastAction = "CLEAR_ANALYTICS_RESET";
  } else {
    return json({ ok: false, error: "kind harus limit, all, atau clear" }, 400);
  }

  await fbPut(dbUrl, "/xauusd/analyticsReset", next);

  return json({
    ok: true,
    message: kind === "all"
      ? "Semua analisis direset mulai sekarang. History trade tetap aman."
      : kind === "limit"
        ? "Analisis Limit Pullback direset mulai sekarang. History trade tetap aman."
        : "Filter reset analisis dibersihkan.",
    analyticsReset: next
  });
}

function normalizeReset(data) {
  return {
    allStartAt: data?.allStartAt || null,
    limitStartAt: data?.limitStartAt || null,
    allResetAt: data?.allResetAt || null,
    limitResetAt: data?.limitResetAt || null,
    updatedAt: data?.updatedAt || null,
    updatedBy: data?.updatedBy || null,
    lastAction: data?.lastAction || null
  };
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

function json(payload, status = 200, headers = { ...H, "Cache-Control": "no-store" }) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}
