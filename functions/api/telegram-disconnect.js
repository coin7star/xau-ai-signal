const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const uid = String(body.uid || "").trim();
  if (!uid) return json({ ok: false, error: "uid wajib diisi" }, 400);

  await fbPatch(dbUrl, `/users/${uid}`, {
    telegramConnected: false,
    telegramChatId: null,
    telegramUsername: null,
    telegramFirstName: null,
    telegramConnectedAt: null,
    telegramConnectCode: null,
    telegramConnectExpiresAt: null,
    updatedAt: new Date().toISOString()
  });

  return json({ ok: true, message: "Telegram disconnected" });
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
