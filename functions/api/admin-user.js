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
  const adminToken = env.ADMIN_ACTION_TOKEN || "";

  if (request.method === "GET") {
    const token = new URL(request.url).searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (adminToken && token !== adminToken) return json({ ok: false, error: "Unauthorized admin token" }, 401);
    const raw = await fbGet(dbUrl, "/users");
    const users = Object.values(raw || {}).filter(Boolean).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return json({ ok: true, users });
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "Body JSON tidak valid" }, 400); }
    const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (adminToken && token !== adminToken) return json({ ok: false, error: "Unauthorized admin token" }, 401);
    const uid = body.uid || "";
    const role = String(body.role || "free").toLowerCase();
    const premiumDays = Number(body.premiumDays || 0);
    const premiumUntil = body.premiumUntil || (premiumDays > 0 ? addDaysIso(premiumDays) : null);
    const resetDevice = Boolean(body.resetDevice);
    if (!uid) return json({ ok: false, error: "uid wajib diisi" }, 400);
    if (!["free", "premium", "admin"].includes(role)) return json({ ok: false, error: "role harus free, premium, atau admin" }, 400);
    const patch = { role, updatedAt: new Date().toISOString(), status: "active" };
    if (role === "premium") patch.premiumUntil = premiumUntil || addDaysIso(30);
    if (role === "free") patch.premiumUntil = null;
    if (role === "admin") patch.premiumUntil = "2099-12-31T23:59:59.000Z";
    if (resetDevice) {
      patch.deviceId = null;
      patch.deviceName = null;
      patch.deviceUserAgent = null;
      patch.deviceBoundAt = null;
      patch.securityStatus = "device-reset";
      patch.suspiciousDeviceAt = null;
    }
    await fbPatch(dbUrl, `/users/${uid}`, patch);
    return json({ ok: true, message: `User ${uid} updated to ${role}`, patch });
  }
  return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
}
function addDaysIso(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 30)); return d.toISOString(); }
async function fbGet(dbUrl, path) { const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (!res.ok) return null; return await res.json(); }
async function fbPatch(dbUrl, path, data) { const res = await fetch(`${dbUrl}${path}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!res.ok) throw new Error(await res.text()); return await res.json(); }
function json(payload, status = 200) { return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } }); }
