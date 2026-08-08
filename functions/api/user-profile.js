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
    const tokenUid = decodeFirebaseUid(idToken);

    // The Realtime Database request below is authenticated with the Firebase ID
    // token itself. This means Firebase Security Rules still protect /users/{uid}
    // and we do not depend on a second Cloudflare secret just to read the profile.
    if (requestedUid && tokenUid && requestedUid !== tokenUid) {
      return json({ ok: false, error: "UID tidak cocok dengan session" }, 403);
    }

    const uid = requestedUid || tokenUid;
    if (!uid) return json({ ok: false, error: "UID Firebase tidak ditemukan" }, 401);

    // Optional server-side token verification when the Firebase Web API key is
    // available. The authenticated RTDB read remains the source of truth.
    const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
    if (apiKey) {
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
        return json({ ok: false, error: "Session Firebase tidak valid atau sudah kedaluwarsa" }, 401);
      }
      const verifiedUid = verifyData?.users?.[0]?.localId || "";
      if (!verifiedUid || verifiedUid !== uid) {
        return json({ ok: false, error: "UID tidak cocok dengan session Firebase" }, 403);
      }
    }

    const user = await fbGet(dbUrl, `/users/${uid}`, idToken);
    if (!user) return json({ ok: false, error: "Profile user tidak ditemukan atau tidak bisa dibaca" }, 404);

    return json({ ok: true, uid, profile: user });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Gagal membaca profile user" }, 500);
  }
}

async function fbGet(dbUrl, path, idToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (idToken) url.searchParams.set("auth", idToken);

  const res = await fetch(url.toString(), {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) throw new Error(`Firebase Database error ${res.status}`);
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
