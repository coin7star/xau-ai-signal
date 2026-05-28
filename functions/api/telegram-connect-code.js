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

  const url = new URL(request.url);

  if (request.method === "GET") {
    const uid = url.searchParams.get("uid") || "";
    if (!uid) return json({ ok: false, error: "uid wajib diisi" }, 400);

    const user = await fbGet(dbUrl, `/users/${uid}`);
    if (!user) return json({ ok: false, error: "User tidak ditemukan" }, 404);

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
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Body JSON tidak valid" }, 400);
    }

    const uid = String(body.uid || "").trim();
    if (!uid) return json({ ok: false, error: "uid wajib diisi" }, 400);

    const user = await fbGet(dbUrl, `/users/${uid}`);
    if (!user) return json({ ok: false, error: "User tidak ditemukan" }, 404);

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
      }).catch(() => {});
    }

    const code = createCode();
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);

    await fbPatch(dbUrl, `/users/${uid}`, {
      telegramConnectCode: code,
      telegramConnectExpiresAt: expires.toISOString(),
      telegramConnectCreatedAt: now.toISOString(),
      updatedAt: now.toISOString()
    });

    await fbPut(dbUrl, `/telegramConnectCodes/${code}`, {
      code,
      uid,
      email: user.email || "",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      used: false,
      securityLevel: "LV1_ONE_TIME_15_MINUTES",
      warning: "Do not share this code. Anyone with this code can connect Telegram to this account."
    });

    return json({
      ok: true,
      code,
      expiresAt: expires.toISOString(),
      instruction: `/connect ${code}`
    });
  }

  return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
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

async function fbPatch(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
