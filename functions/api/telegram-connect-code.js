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

  try {
    const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!idToken) return json({ ok: false, error: "Kamu harus login dulu." }, 401);

    const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
    const uid = await verifyFirebaseIdToken(idToken, apiKey);
    if (!uid) return json({ ok: false, error: "Session login tidak valid, silakan login ulang." }, 401);

    let accessToken = null;
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);

    const user = await fbGet(dbUrl, `/users/${uid}`, accessToken);
    if (!user) return json({ ok: false, error: "User tidak ditemukan" }, 404);

    if (request.method === "GET") {
      return json({
        ok: true,
        telegramConnected: Boolean(user.telegramConnected && user.telegramChatId),
        telegramChatId: maskChatId(user.telegramChatId),
        telegramUsername: user.telegramUsername || "",
        telegramConnectedAt: user.telegramConnectedAt || null,
        telegramCode: user.telegramConnectCode || null,
        telegramCodeExpiresAt: user.telegramConnectExpiresAt || null
      });
    }

    if (request.method === "POST") {
      if (!isPremium(user)) {
        return json({ ok: false, error: "Hanya user premium/admin yang bisa connect Telegram" }, 403);
      }

      const oldCode = user.telegramConnectCode || null;
      if (oldCode) {
        await fbPatch(dbUrl, `/telegramConnectCodes/${oldCode}`, {
          used: true,
          invalidated: true,
          invalidatedAt: new Date().toISOString(),
          reason: "new-code-generated"
        }, accessToken).catch(() => {});
      }

      const code = createCode();
      const now = new Date();
      const expires = new Date(now.getTime() + 15 * 60 * 1000);

      await fbPatch(dbUrl, `/users/${uid}`, {
        telegramConnectCode: code,
        telegramConnectExpiresAt: expires.toISOString(),
        telegramConnectCreatedAt: now.toISOString(),
        updatedAt: now.toISOString()
      }, accessToken);

      await fbPut(dbUrl, `/telegramConnectCodes/${code}`, {
        code,
        uid,
        email: user.email || "",
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        used: false,
        securityLevel: "LV1_ONE_TIME_15_MINUTES",
        warning: "Do not share this code. Anyone with this code can connect Telegram to this account."
      }, accessToken);

      return json({ ok: true, code, expiresAt: expires.toISOString(), instruction: `/connect ${code}` });
    }

    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  } catch (error) {
    console.error("telegram-connect-code error", error);
    return json({ ok: false, error: error?.message || "Terjadi kesalahan tak terduga di server." }, 500);
  }
}

function createCode() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `XAU-${n}`;
}

function isPremium(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  if (!user.premiumUntil && !user.expiredAt) return false;
  return new Date(user.premiumUntil || user.expiredAt).getTime() > Date.now();
}

function maskChatId(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
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
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) return null;
  return await res.json();
}
async function fbPut(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
async function fbPatch(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } });
}

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
