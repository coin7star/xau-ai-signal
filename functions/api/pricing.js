/**
 * XAU AI Signal - Pricing & Promo
 *
 * Tujuan:
 * - GET tanpa token: dipanggil frontend publik (PremiumBox) buat nampilin
 *   daftar paket premium yang aktif (harga bisa diubah admin kapan saja
 *   tanpa perlu redeploy).
 * - GET dengan Authorization: Bearer <ADMIN_ACTION_TOKEN>: dipanggil panel
 *   admin, balikin SEMUA paket termasuk yang nonaktif, biar bisa diedit.
 * - POST dengan token admin: simpan (create/update) atau hapus satu paket.
 *
 * Data disimpan di RTDB: /pricing/packages/{CODE}
 * Kalau node ini belum pernah diisi, fallback ke DEFAULT_PACKAGES (2 paket
 * lama: 7D & 30D) supaya premium box tidak pernah kosong.
 *
 * Auth & akses RTDB: sama pola dengan admin-orders.js / admin-dashboard-
 * summary.js -> pakai service-account access token biar lolos security
 * rules RTDB, baik buat baca (publik) maupun tulis (admin only).
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const DEFAULT_PACKAGES = [
  { code: "7D", label: "7 Hari", durationDays: 7, priceLabel: "Rp10K", active: true, sortOrder: 1, promo: null },
  { code: "30D", label: "30 Hari", durationDays: 30, priceLabel: "Rp30K", active: true, sortOrder: 2, promo: null }
];

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (err) {
    return json({ ok: false, error: `Gagal ambil service-account token: ${err.message || err}` }, 500);
  }
  if (!accessToken) {
    return json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Cloudflare Pages env." }, 500);
  }

  const admin = isAdminRequest(request, env);

  if (request.method === "GET") {
    const raw = await fbGet(dbUrl, "/pricing/packages", accessToken);
    let list = raw && typeof raw === "object" ? Object.values(raw).filter(Boolean) : [];
    if (!list.length) list = DEFAULT_PACKAGES;

    list = list.map((p) => ({ ...p, promo: normalizePromoForResponse(p.promo) }));
    if (!admin) list = list.filter((p) => p.active !== false);

    list.sort((a, b) => (Number(a.sortOrder) || 99) - (Number(b.sortOrder) || 99));
    return json({ ok: true, packages: list });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!admin) return json({ ok: false, error: "Unauthorized admin token" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const action = String(body.action || "save").toLowerCase();
  const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!code) return json({ ok: false, error: "Kode paket wajib diisi (huruf/angka, contoh: 7D)" }, 400);

  if (action === "delete") {
    await fbDelete(dbUrl, `/pricing/packages/${code}`, accessToken);
    return json({ ok: true, deleted: code });
  }

  const existing = (await fbGet(dbUrl, `/pricing/packages/${code}`, accessToken)) || {};
  const now = new Date().toISOString();

  const label = safeText(body.label || existing.label || code).slice(0, 60);
  const priceLabel = safeText(body.priceLabel || existing.priceLabel || "").slice(0, 30);
  const durationDays = Number(body.durationDays ?? existing.durationDays ?? 0);

  if (!durationDays || durationDays <= 0) {
    return json({ ok: false, error: "Durasi (hari) wajib diisi & harus lebih dari 0" }, 400);
  }
  if (!priceLabel) {
    return json({ ok: false, error: "Harga wajib diisi, contoh: Rp10K" }, 400);
  }

  const pkg = {
    code,
    label,
    durationDays,
    priceLabel,
    active: body.active !== undefined ? !!body.active : existing.active !== false,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : (existing.sortOrder ?? 99),
    promo: normalizePromoForWrite(body.promo),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };

  await fbPut(dbUrl, `/pricing/packages/${code}`, pkg, accessToken);
  return json({ ok: true, package: pkg });
}

function normalizePromoForWrite(promo) {
  if (!promo || !promo.active) return null;
  return {
    active: true,
    label: safeText(promo.label || "PROMO").slice(0, 30),
    originalPriceLabel: safeText(promo.originalPriceLabel || "").slice(0, 30),
    until: promo.until ? new Date(promo.until).toISOString() : null
  };
}

function normalizePromoForResponse(promo) {
  if (!promo || !promo.active) return null;
  if (promo.until && new Date(promo.until).getTime() < Date.now()) return null; // auto-expire, tidak perlu admin hapus manual
  return promo;
}

function isAdminRequest(request, env) {
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  if (!adminToken) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || new URL(request.url).searchParams.get("token")
    || "";
  return token === adminToken;
}

function safeText(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  url.searchParams.set("ts", String(Date.now()));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Firebase GET failed ${res.status}`);
  return await res.json();
}

async function fbPut(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase PUT failed ${res.status}: ${text}`);
  }
  return await res.json();
}

async function fbDelete(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase DELETE failed ${res.status}: ${text}`);
  }
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}

// ---- Firebase service-account OAuth (sama pola dengan admin-orders.js) ----
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
function base64UrlJson(value) {
  return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer);
}
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
