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
  const code = String(body.code || "").replace(/\D/g, "");

  if (!uid || code.length !== 6) {
    return json({ ok: false, error: "UID dan kode 6 digit wajib diisi" }, 400);
  }

  const saved = await fbGet(dbUrl, `/emailCodes/${uid}`);

  if (!saved || saved.used) {
    return json({ ok: false, error: "Kode tidak ditemukan atau sudah dipakai" }, 400);
  }

  if (Date.now() > new Date(saved.expiresAt).getTime()) {
    return json({ ok: false, error: "Kode sudah expired. Kirim ulang kode." }, 400);
  }

  if (String(saved.code) !== code) {
    return json({ ok: false, error: "Kode verifikasi salah" }, 400);
  }

  const now = new Date().toISOString();

  await fbPatch(dbUrl, `/users/${uid}`, {
    emailCodeVerified: true,
    emailVerified: true,
    verifiedAt: now,
    updatedAt: now
  });

  await fbPatch(dbUrl, `/emailCodes/${uid}`, {
    used: true,
    usedAt: now
  });

  return json({
    ok: true,
    message: "Email berhasil diverifikasi dengan kode"
  });
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
