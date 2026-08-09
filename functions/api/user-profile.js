const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return json({ ok: false, error: "Authorization token wajib" }, 401);

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset di Cloudflare" }, 500);

  try {
    const requestedUid = new URL(request.url).searchParams.get("uid") || "";

    // Verify the signed-in Firebase user before reading any profile.
    const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
    const verifiedUid = await verifyFirebaseIdToken(idToken, apiKey);
    if (!verifiedUid) return json({ ok: false, error: "Session Firebase tidak valid" }, 401);
    if (requestedUid && requestedUid !== verifiedUid) {
      return json({ ok: false, error: "UID tidak cocok dengan session Firebase" }, 403);
    }

    const uid = verifiedUid;

    // IMPORTANT: the legacy /users/{uid} record is the source of truth.
    // Use the Firebase service account when available so this endpoint does
    // not depend on client-side Realtime Database security rules.
    let user = null;
    const service = readServiceAccount(env);
    if (service) {
      const accessToken = await getGoogleAccessToken(service);
      user = await fbGet(dbUrl, `/users/${uid}`, accessToken);
    } else {
      // Backward-compatible fallback for deployments that only have the
      // Firebase Web config. This path is still protected by the ID token.
      user = await fbGet(dbUrl, `/users/${uid}`, idToken);
    }

    if (!user || typeof user !== "object") {
      return json({ ok: false, error: "Profile user tidak ditemukan atau tidak bisa dibaca" }, 404);
    }

    // Never allow a malformed/partial profile to be interpreted as FREE.
    if (!user.role) {
      return json({ ok: false, error: "Profile terbaca tetapi field role tidak ada" }, 422);
    }

    return json({ ok: true, uid, profile: user });
  } catch (error) {
    console.error("user-profile error", error);
    return json({ ok: false, error: error?.message || "Gagal membaca profile user" }, 500);
  }
}

async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!apiKey) {
    const uid = decodeFirebaseUid(idToken);
    if (!uid) throw new Error("FIREBASE_WEB_API_KEY belum diset dan UID token tidak dapat dibaca");
    return uid;
  }

  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) {
    throw new Error("Session Firebase tidak valid atau sudah kedaluwarsa");
  }
  return verifyData?.users?.[0]?.localId || "";
}

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
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "Gagal mengambil Firebase service-account access token.");
  }
  return data.access_token;
}

async function signRs256(input, privateKeyPem) {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );
  return arrayBufferToBase64Url(signature);
}

function pemToArrayBuffer(pem) {
  const clean = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
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
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firebase Database error ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
  return await res.json();
}

function decodeFirebaseUid(idToken) {
  try {
    const part = String(idToken).split(".")[1];
    if (!part) return "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonText = atob(padded);
    const payload = JSON.parse(jsonText);
    return String(payload.user_id || payload.sub || "");
  } catch {
    return "";
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
