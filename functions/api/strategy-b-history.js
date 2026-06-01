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

  if (request.method === "GET") {
    const raw = await fbGet(dbUrl, "/xauusd/strategyB/history");
    const list = Object.values(raw || {})
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 100);

    return json({
      ok: true,
      strategyKey: "strategyB",
      strategyName: "SMC AI",
      mode: "LIVE_BACKTEST_ONLY",
      stats: buildStats(list),
      history: list
    }, 200, {
      ...H,
      "Cache-Control": "public, max-age=45, s-maxage=45, stale-while-revalidate=45"
    });
  }

  if (request.method === "POST") {
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

    const id = body.id || "";
    const result = String(body.result || "").toUpperCase();

    if (!id) return json({ ok: false, error: "id wajib diisi" }, 400);
    if (!["WIN", "LOSS", "BE", "OPEN", "EXPIRED"].includes(result)) {
      return json({ ok: false, error: "result harus WIN, LOSS, BE, EXPIRED, atau OPEN" }, 400);
    }

    const existing = await fbGet(dbUrl, `/xauusd/strategyB/history/${id}`);
    if (!existing) return json({ ok: false, error: "Strategy B history tidak ditemukan" }, 404);

    const updated = {
      ...existing,
      status: result === "OPEN" ? "OPEN" : "CLOSED",
      result: result === "OPEN" ? null : result,
      closedAt: result === "OPEN" ? null : new Date().toISOString(),
      note: body.note || existing.note || ""
    };

    await fbPut(dbUrl, `/xauusd/strategyB/history/${id}`, updated);

    const raw = await fbGet(dbUrl, "/xauusd/strategyB/history");
    const list = Object.values(raw || {})
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 100);

    return json({
      ok: true,
      message: `SMC AI ${id} updated to ${result}`,
      item: updated,
      stats: buildStats(list)
    });
  }

  return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
}

function buildStats(list) {
  const closed = list.filter((x) => x.status === "CLOSED");
  const wins = closed.filter((x) => x.result === "WIN").length;
  const losses = closed.filter((x) => x.result === "LOSS").length;
  const be = closed.filter((x) => x.result === "BE").length;
  const expired = closed.filter((x) => x.result === "EXPIRED").length;
  const totalClosed = closed.length;
  const cleanClosed = wins + losses + be;
  const winRate = cleanClosed > 0 ? Number(((wins / cleanClosed) * 100).toFixed(1)) : 0;
  const totalWinRate = totalClosed > 0 ? Number(((wins / totalClosed) * 100).toFixed(1)) : 0;
  const open = list.filter((x) => x.status !== "CLOSED").length;
  const totalRisk = closed.reduce((sum, item) => {
    const entry = Number(item.entry || 0);
    const sl = Number(item.sl || 0);
    return sum + Math.abs(entry - sl);
  }, 0);
  const totalReward = closed.reduce((sum, item) => {
    const entry = Number(item.entry || 0);
    const tp = Number(item.tp || 0);
    return sum + Math.abs(tp - entry);
  }, 0);

  return {
    total: list.length,
    open,
    closed: totalClosed,
    cleanClosed,
    wins,
    losses,
    be,
    expired,
    winRate,
    totalWinRate,
    averageRR: totalRisk > 0 && totalClosed > 0 ? Number((totalReward / totalRisk).toFixed(2)) : 0,
    averageTP: totalClosed > 0 ? Number((totalReward / totalClosed).toFixed(2)) : 0,
    averageSL: totalClosed > 0 ? Number((totalRisk / totalClosed).toFixed(2)) : 0,
    profitFactor: losses > 0 ? Number((wins / losses).toFixed(2)) : wins > 0 ? wins : 0
  };
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
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers
  });
}
