/**
 * XAU AI Signal - Program Referral "Ajak Teman"
 *
 * Tujuan:
 * - Reward buat user yang effort ngajak teman gabung/langganan (bangun
 *   komunitas), DAN kasih benefit juga ke temannya yang diajak (win-win,
 *   biar makin banyak yang penasaran & mau coba).
 *
 * Cara kerja:
 * 1. Tiap user punya kode referral unik (`/users/{uid}/referralCode`),
 *    otomatis dibikin pas pertama kali buka dashboard.
 * 2. Teman daftar lewat link `?ref=KODE`. Begitu akun barunya kebentuk,
 *    frontend manggil action=link buat nyambungin `referredBy`.
 * 3. Begitu link berhasil, temannya langsung dikasih 1 voucher WELCOME
 *    sekali-pakai (reuse /vouchers/{CODE} - endpoint voucher.js yang udah
 *    ada) - jadi pembelian pertama dia otomatis lebih murah.
 * 4. Begitu admin approve order pertama si teman (lihat admin-orders.js),
 *    referrer (yang ngajak) otomatis dapet tambahan hari premium GRATIS.
 *    Reward cuma sekali per orang yang diajak (bukan tiap dia perpanjang).
 *
 * Data disimpan di RTDB:
 * - /users/{uid}/referralCode, /users/{uid}/referredBy, /referredByCode
 * - /referralCodes/{CODE} -> uid                (index buat lookup cepat)
 * - /referrals/{referrerUid}/{referredUid} = {..., status, rewardDays}
 * - /referralConfig = { rewardDays, refereeDiscountPercent, active }
 *
 * Node-node ini juga sengaja tidak ada di security rules publik, jadi
 * cuma bisa diakses lewat endpoint ini (service-account access token),
 * sama persis pola dengan pricing.js & voucher.js.
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const DEFAULT_CONFIG = { rewardDays: 3, refereeDiscountPercent: 15, active: true };

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
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (admin) {
      return await handleAdminOverview({ dbUrl, accessToken });
    }
    return await handleMe({ request, env, dbUrl, accessToken });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const action = String(body.action || "").toLowerCase();

  if (action === "config") {
    if (!admin) return json({ ok: false, error: "Unauthorized admin token" }, 401);
    const now = new Date().toISOString();
    const config = {
      rewardDays: Math.max(1, Number(body.rewardDays) || DEFAULT_CONFIG.rewardDays),
      refereeDiscountPercent: Math.min(90, Math.max(0, Number(body.refereeDiscountPercent) || 0)),
      active: body.active !== undefined ? !!body.active : true,
      updatedAt: now
    };
    await fbPut(dbUrl, "/referralConfig", config, accessToken);
    return json({ ok: true, config });
  }

  if (action === "link") {
    return await handleLink({ request, env, dbUrl, accessToken, body });
  }

  return json({ ok: false, error: "action tidak dikenali" }, 400);
}

// ---- GET /api/referral (user, butuh login) ----
async function handleMe({ request, env, dbUrl, accessToken }) {
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return json({ ok: false, error: "Kamu harus login dulu." }, 401);

  const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
  const uid = await verifyFirebaseIdToken(idToken, apiKey);
  if (!uid) return json({ ok: false, error: "Session login tidak valid, silakan login ulang." }, 401);

  let userRecord = (await fbGet(dbUrl, `/users/${uid}`, accessToken)) || {};
  let code = userRecord.referralCode || "";

  if (!code) {
    code = await generateUniqueCode(dbUrl, accessToken, uid, userRecord.email);
    await fbPatch(dbUrl, `/users/${uid}`, { referralCode: code, updatedAt: new Date().toISOString() }, accessToken);
    await fbPut(dbUrl, `/referralCodes/${code}`, uid, accessToken);
    userRecord = { ...userRecord, referralCode: code };
  }

  const referralsRaw = (await fbGet(dbUrl, `/referrals/${uid}`, accessToken)) || {};
  const referrals = Object.values(referralsRaw).filter(Boolean)
    .sort((a, b) => new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime());

  const rewardedCount = referrals.filter((r) => r.status === "rewarded").length;
  const totalDaysEarned = referrals.reduce((sum, r) => sum + (r.status === "rewarded" ? Number(r.rewardDays || 0) : 0), 0);

  const appUrl = env.APP_URL || env.VITE_APP_URL || "https://xau-ai-signal.pages.dev";

  return json({
    ok: true,
    code,
    link: `${appUrl}?ref=${code}`,
    stats: { totalInvited: referrals.length, rewarded: rewardedCount, pending: referrals.length - rewardedCount, totalDaysEarned },
    referrals: referrals.map((r) => ({
      email: maskEmail(r.email),
      joinedAt: r.joinedAt,
      status: r.status,
      rewardDays: r.rewardDays || null,
      rewardedAt: r.rewardedAt || null
    }))
  });
}

// ---- POST /api/referral action=link (user, butuh login) ----
async function handleLink({ request, env, dbUrl, accessToken, body }) {
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return json({ ok: false, error: "Kamu harus login dulu." }, 401);

  const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
  const uid = await verifyFirebaseIdToken(idToken, apiKey);
  if (!uid) return json({ ok: false, error: "Session login tidak valid, silakan login ulang." }, 401);

  const code = normalizeCode(body.code);
  if (!code) return json({ ok: false, error: "Kode referral wajib diisi." }, 400);

  const me = (await fbGet(dbUrl, `/users/${uid}`, accessToken)) || {};
  if (me.referredBy) {
    return json({ ok: true, alreadyLinked: true, message: "Akun ini sudah tersambung ke referral sebelumnya." });
  }

  const referrerUid = await fbGet(dbUrl, `/referralCodes/${code}`, accessToken);
  if (!referrerUid || typeof referrerUid !== "string") {
    return json({ ok: false, error: "Kode referral tidak ditemukan." }, 200);
  }
  if (referrerUid === uid) {
    return json({ ok: false, error: "Tidak bisa pakai kode referral sendiri." }, 200);
  }

  const now = new Date().toISOString();
  await fbPatch(dbUrl, `/users/${uid}`, { referredBy: referrerUid, referredByCode: code, updatedAt: now }, accessToken);

  const referralRecord = {
    uid,
    email: me.email || "",
    joinedAt: now,
    status: "pending",
    rewardDays: null,
    rewardedAt: null
  };
  await fbPut(dbUrl, `/referrals/${referrerUid}/${uid}`, referralRecord, accessToken);

  // Kasih welcome voucher sekali-pakai buat si teman yang baru gabung -
  // reuse skema voucher yang sama dengan endpoint voucher.js.
  let welcomeVoucher = null;
  try {
    const config = (await fbGet(dbUrl, "/referralConfig", accessToken)) || DEFAULT_CONFIG;
    const discountPercent = Number(config.refereeDiscountPercent ?? DEFAULT_CONFIG.refereeDiscountPercent);
    if (discountPercent > 0) {
      const voucherCode = `WELCOME${uid.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`;
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 hari
      const voucher = {
        code: voucherCode,
        label: "Welcome Referral",
        discountType: "percent",
        discountValue: discountPercent,
        packageCode: null,
        maxUses: 1,
        usedCount: 0,
        active: true,
        expiresAt: expires,
        redeemedBy: null,
        createdAt: now,
        updatedAt: now
      };
      await fbPut(dbUrl, `/vouchers/${voucherCode}`, voucher, accessToken);
      welcomeVoucher = { code: voucherCode, discountPercent, expiresAt: expires };
    }
  } catch {
    // welcome voucher gagal dibuat -> tetap lanjut, linking referral lebih penting
  }

  return json({ ok: true, linked: true, referrerUid, welcomeVoucher });
}

// ---- GET /api/referral (admin) ----
async function handleAdminOverview({ dbUrl, accessToken }) {
  const config = (await fbGet(dbUrl, "/referralConfig", accessToken)) || DEFAULT_CONFIG;
  const referralsRaw = (await fbGet(dbUrl, "/referrals", accessToken)) || {};
  const usersRaw = (await fbGet(dbUrl, "/users", accessToken)) || {};

  const leaderboard = Object.entries(referralsRaw).map(([referrerUid, referredMap]) => {
    const referred = Object.values(referredMap || {}).filter(Boolean);
    const rewarded = referred.filter((r) => r.status === "rewarded");
    const totalDays = rewarded.reduce((sum, r) => sum + (Number(r.rewardDays) || 0), 0);
    const owner = usersRaw[referrerUid] || {};
    return {
      uid: referrerUid,
      email: owner.email || "-",
      referralCode: owner.referralCode || "-",
      totalInvited: referred.length,
      rewarded: rewarded.length,
      totalDaysEarned: totalDays
    };
  })
    .filter((row) => row.totalInvited > 0)
    .sort((a, b) => b.rewarded - a.rewarded || b.totalInvited - a.totalInvited);

  return json({ ok: true, config: { ...DEFAULT_CONFIG, ...config }, leaderboard: leaderboard.slice(0, 50) });
}

async function generateUniqueCode(dbUrl, accessToken, uid, email) {
  const base = String(email || uid).split("@")[0].replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "USER";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `${base}${suffix}`;
    const existing = await fbGet(dbUrl, `/referralCodes/${candidate}`, accessToken);
    if (!existing) return candidate;
  }
  return `REF${uid.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`;
}

function maskEmail(email) {
  const s = String(email || "");
  const at = s.indexOf("@");
  if (at <= 1) return s ? `${s[0] || ""}***` : "-";
  return `${s.slice(0, 2)}***${s.slice(at)}`;
}

function normalizeCode(v) {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function isAdminRequest(request, env) {
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  if (!adminToken) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || new URL(request.url).searchParams.get("token")
    || "";
  return token === adminToken;
}

async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY belum diset di Cloudflare.");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return "";
  return data?.users?.[0]?.localId || "";
}

// ---- Firebase RTDB REST helpers ----
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

async function fbPatch(dbUrl, path, patch, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
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

// ---- Firebase service-account OAuth (sama pola dengan pricing.js / voucher.js) ----
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
