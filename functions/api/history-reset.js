const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const confirm = String(body.confirm || "").trim().toUpperCase();
  if (confirm !== "CLEAR_HISTORY") {
    return json({
      ok: false,
      error: "Konfirmasi wajib diisi CLEAR_HISTORY agar history trade tidak terhapus tidak sengaja."
    }, 400);
  }

  const rawBefore = await fbGet(dbUrl, "/xauusd/callHistory");
  const deletedCount = rawBefore && typeof rawBefore === "object" ? Object.keys(rawBefore).length : 0;
  const now = new Date().toISOString();

  // Hapus history sinyal utama. Ini otomatis membuat WR, TP1/BE, dan Limit analytics kembali kosong
  // karena semua panel membaca sumber dari callHistory.
  await fbPut(dbUrl, "/xauusd/callHistory", null);

  // Simpan audit kecil supaya admin tahu kapan pembersihan dilakukan.
  await fbPut(dbUrl, "/xauusd/historyReset", {
    lastClearedAt: now,
    deletedCount,
    updatedBy: "admin",
    lastAction: "CLEAR_TRADE_HISTORY"
  });

  // Reset titik analisis juga supaya periode baru benar-benar terasa mulai dari nol.
  const analyticsReset = {
    allStartAt: now,
    limitStartAt: now,
    allResetAt: now,
    limitResetAt: now,
    updatedAt: now,
    updatedBy: "admin",
    lastAction: "CLEAR_TRADE_HISTORY_RESET_ANALYTICS"
  };
  await fbPut(dbUrl, "/xauusd/analyticsReset", analyticsReset);

  return json({
    ok: true,
    message: `History trade berhasil dibersihkan. ${deletedCount} data lama dihapus. Analisis mulai dari nol.`,
    deletedCount,
    historyReset: {
      lastClearedAt: now,
      deletedCount,
      lastAction: "CLEAR_TRADE_HISTORY"
    },
    analyticsReset
  });
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

function json(payload, status = 200, headers = { ...H, "Cache-Control": "no-store" }) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}
