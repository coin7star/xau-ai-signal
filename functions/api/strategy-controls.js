const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const DEFAULT_CONTROLS = {
  mainSignalAlert: true,
  mainSignalResultAlert: true,
  m1ScalpTracking: true,
  m1ScalpResultTracking: true,
  strategyBLiveBacktest: true,
  strategyBAdminAlert: true,
  strategyBResultAdminAlert: true,
  strategyBPremiumUserAlert: false,
  updatedAt: null,
  updatedBy: "system-default"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "Live Data Engine belum tersambung." }, 500);

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const token = request.method === "GET"
    ? new URL(request.url).searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "") || ""
    : request.headers.get("Authorization")?.replace("Bearer ", "") || "";

  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Kode admin tidak valid." }, 401);
  }

  if (request.method === "GET") {
    const controls = await getControls(dbUrl);
    return json({ ok: true, controls, defaults: DEFAULT_CONTROLS });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid." }, 400);
  }

  const bodyToken = body.token || token;
  if (adminToken && bodyToken !== adminToken) {
    return json({ ok: false, error: "Kode admin tidak valid." }, 401);
  }

  const incoming = body.controls || {};
  const current = await getControls(dbUrl);
  const next = {
    ...current,
    mainSignalAlert: toBool(incoming.mainSignalAlert, current.mainSignalAlert),
    mainSignalResultAlert: toBool(incoming.mainSignalResultAlert, current.mainSignalResultAlert),
    m1ScalpTracking: toBool(incoming.m1ScalpTracking, current.m1ScalpTracking),
    m1ScalpResultTracking: toBool(incoming.m1ScalpResultTracking, current.m1ScalpResultTracking),
    strategyBLiveBacktest: toBool(incoming.strategyBLiveBacktest, current.strategyBLiveBacktest),
    strategyBAdminAlert: toBool(incoming.strategyBAdminAlert, current.strategyBAdminAlert),
    strategyBResultAdminAlert: toBool(incoming.strategyBResultAdminAlert, current.strategyBResultAdminAlert),
    strategyBPremiumUserAlert: toBool(incoming.strategyBPremiumUserAlert, current.strategyBPremiumUserAlert),
    updatedAt: new Date().toISOString(),
    updatedBy: "admin-dashboard"
  };

  await fbPut(dbUrl, "/xauusd/settings/strategyControls", next);

  return json({
    ok: true,
    message: "Strategy Control Center berhasil disimpan.",
    controls: next,
    note: "Master switch admin aktif. User premium tetap mengikuti personal toggle masing-masing."
  });
}

async function getControls(dbUrl) {
  const raw = await fbGet(dbUrl, "/xauusd/settings/strategyControls");
  return { ...DEFAULT_CONTROLS, ...(raw || {}) };
}

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(fallback);
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } });
}
