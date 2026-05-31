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

  const user = await fbGet(dbUrl, `/users/${uid}`);
  if (!user) return json({ ok: false, error: "User tidak ditemukan" }, 404);
  if (!user.telegramConnected || !user.telegramChatId) {
    return json({ ok: false, error: "Telegram belum terhubung." }, 400);
  }

  const mainSignal = normalizeBool(body.mainSignal, user.telegramAlertMainSignal !== false);
  const result = normalizeBool(body.result, user.telegramAlertResult !== false);
  const enabled = Boolean(mainSignal || result);
  const now = new Date().toISOString();

  const patch = {
    telegramAlertEnabled: enabled,
    telegramAlertMainSignal: mainSignal,
    telegramAlertResult: result,
    telegramAlertUpdatedAt: now,
    updatedAt: now
  };

  await fbPatch(dbUrl, `/users/${uid}`, patch);

  return json({
    ok: true,
    message: "Preferensi Telegram alert berhasil disimpan.",
    telegramAlerts: {
      enabled,
      mainSignal,
      result,
      updatedAt: now
    }
  });
}

function normalizeBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(fallback);
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
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
