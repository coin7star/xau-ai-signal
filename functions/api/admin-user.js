const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  const token = new URL(request.url).searchParams.get("token")
    || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    || "";
  if (!adminToken || token !== adminToken) return json({ ok: false, error: "Unauthorized admin token" }, 401);

  // Pakai service account (sama pola dengan admin-signal.js / admin-orders.js) supaya
  // request ke Firebase RTDB dianggap "admin" dan tidak diblokir oleh security rules
  // (rules cuma izinkan user baca/tulis /users/{uid} miliknya sendiri).
  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (e) {
    return json({ ok: false, error: `Gagal ambil Firebase service-account token: ${e?.message || e}` }, 500);
  }

  try {
    if (request.method === "GET") {
      const raw = await fbGet(dbUrl, "/users", accessToken);
      const users = Object.values(raw || {}).filter(Boolean)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return json({ ok: true, users });
    }

    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Body JSON tidak valid" }, 400); }
      const uid = String(body.uid || "").trim();
      if (!uid) return json({ ok: false, error: "uid wajib diisi" }, 400);

      const existing = await fbGet(dbUrl, `/users/${uid}`, accessToken);
      if (!existing) return json({ ok: false, error: "User tidak ditemukan" }, 404);

      const action = String(body.action || "setRole").toLowerCase();

      if (action === "revokepremium") {
        const patch = { role: "free", premiumUntil: null, updatedAt: new Date().toISOString(), premiumRevokedAt: new Date().toISOString() };
        await fbPatch(dbUrl, `/users/${uid}`, patch, accessToken);
        return json({ ok: true, message: `Premium user ${uid} dicabut.`, patch });
      }

      const role = String(body.role || "free").toLowerCase();
      if (!["free", "premium", "admin"].includes(role)) return json({ ok: false, error: "role harus free, premium, atau admin" }, 400);

      const premiumDays = Number(body.premiumDays || 0);
      const now = new Date().toISOString();
      const patch = { role, updatedAt: now, status: "active" };

      if (role === "premium") {
        // Kalau masih ada sisa premium yang belum expired, nambahin hari BUKAN nimpa dari sekarang.
        const currentUntil = existing.premiumUntil ? new Date(existing.premiumUntil).getTime() : 0;
        const base = currentUntil > Date.now() ? currentUntil : Date.now();
        patch.premiumUntil = body.premiumUntil || addDaysIso(premiumDays > 0 ? premiumDays : 30, base);
        patch.premiumGrantedBy = "admin-manual";
        patch.premiumGrantedAt = now;
      }
      if (role === "free") patch.premiumUntil = null;
      if (role === "admin") patch.premiumUntil = "2099-12-31T23:59:59.000Z";

      await fbPatch(dbUrl, `/users/${uid}`, patch, accessToken);
      return json({ ok: true, message: `User ${uid} diupdate ke ${role}`, patch });
    }

    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  } catch (e) {
    console.error("admin-user error", e);
    return json({ ok: false, error: e?.message || "Terjadi kesalahan tak terduga di server." }, 500);
  }
}

function addDaysIso(days, fromMs) {
  const d = new Date(fromMs || Date.now());
  d.setDate(d.getDate() + Number(days || 30));
  return d.toISOString();
}

// ---- Firebase RTDB REST helpers (dengan service-account access token) ----
async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) return null;
  return await res.json();
}
async function fbPatch(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
function json(payload, status = 200) { return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } }); }

// ---- Firebase service-account OAuth (sama pola dengan admin-signal.js) ----
function readServiceAccount(env) {
  const jsonRaw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_ADMIN_SERVICE_ACCOUNT || "";
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      return normalizeServiceAccount({
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: parsed.private_key || parsed.privateKey
      });
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak valid.");
    }
  }
  const projectId = env.FIREBASE_PROJECT_ID || env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "";
  const clientEmail = env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_ADMIN_CLIENT_EMAIL || "";
  const privateKey = env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY || env.FIREBASE_ADMIN_PRIVATE_KEY || "";
  if (!projectId || !clientEmail || !privateKey) return null;
  return normalizeServiceAccount({ projectId, clientEmail, privateKey });
}
function normalizeServiceAccount({ projectId, clientEmail, privateKey }) {
  const cleanProjectId = String(projectId || "").trim();
  const cleanClientEmail = String(clientEmail || "").trim();
  const cleanPrivateKey = String(privateKey || "").replace(/\\n/g, "\n").trim();
  if (!cleanProjectId || !cleanClientEmail || !cleanPrivateKey) return null;
  return { projectId: cleanProjectId, clientEmail: cleanClientEmail, privateKey: cleanPrivateKey };
}
async function getGoogleAccessToken(service) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: service.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = await signRs256(unsigned, service.privateKey);
  const assertion = `${unsigned}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "Gagal mengambil Firebase service-account access token.");
  }
  return data.access_token;
}
async function signRs256(input, privateKeyPem) {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return arrayBufferToBase64Url(signature);
}
function pemToArrayBuffer(pem) {
  const clean = String(pem || "").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function base64UrlJson(value) { return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer); }
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
