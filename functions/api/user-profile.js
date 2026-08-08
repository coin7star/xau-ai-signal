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

  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_WEB_API_KEY || "";
  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!apiKey) return json({ ok: false, error: "VITE_FIREBASE_API_KEY belum diset di Cloudflare" }, 500);
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset di Cloudflare" }, 500);

  try {
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) return json({ ok: false, error: "Session Firebase tidak valid atau sudah kedaluwarsa" }, 401);

    const firebaseUser = verifyData?.users?.[0];
    const uid = firebaseUser?.localId || "";
    if (!uid) return json({ ok: false, error: "UID Firebase tidak ditemukan" }, 401);

    const requestedUid = new URL(request.url).searchParams.get("uid") || "";
    if (requestedUid && requestedUid !== uid) return json({ ok: false, error: "UID tidak cocok dengan session" }, 403);

    const user = await fbGet(dbUrl, `/users/${uid}`);
    if (!user) return json({ ok: false, error: "Profile user tidak ditemukan" }, 404);

    return json({ ok: true, uid, profile: user });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Gagal membaca profile user" }, 500);
  }
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) throw new Error(`Firebase Database error ${res.status}`);
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
