const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: H });
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");

  if (!dbUrl) {
    return j({ ok: false, error: "ENV FIREBASE_DATABASE_URL belum diset" }, 500);
  }

  if (request.method === "GET") {
    const data = await fbGet(dbUrl, "/xauusd/latest");

    if (!data) {
      return j({
        ok: false,
        mode: "waiting-mt5-data",
        message: "Belum ada data MT5 di Firebase."
      });
    }

    return j(data);
  }

  if (request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return j({ ok: false, error: "Body JSON tidak valid" }, 400);
    }

    const envToken = env.MT5_INGEST_TOKEN || "";
    const mt5Token = body.token || "";

    if (!envToken) {
      return j({ ok: false, error: "ENV MT5_INGEST_TOKEN belum diset" }, 500);
    }

    if (mt5Token !== envToken) {
      return j({ ok: false, error: "Unauthorized: token MT5 salah" }, 401);
    }

    const symbol = body.symbol || "XAUUSD";
    const candles = Array.isArray(body.candles) ? body.candles.slice(-500) : [];

    const payload = {
      ok: true,
      source: "mt5",
      symbol,
      timeframe: body.timeframe || "M1",
      bid: Number(body.bid || 0),
      ask: Number(body.ask || 0),
      digits: Number(body.digits || 2),
      serverTime: body.serverTime || null,
      receivedAt: new Date().toISOString(),
      candles
    };

    await fbPut(dbUrl, "/xauusd/latest", payload);

    return j({
      ok: true,
      message: "Market data saved to Firebase",
      symbol,
      candleCount: candles.length,
      receivedAt: payload.receivedAt
    });
  }

  return j({ ok: false, error: `Method ${request.method} not allowed` }, 405);
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json`);
  if (!res.ok) return null;
  return await res.json();
}

async function fbPut(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return await res.json();
}

function j(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: H
  });
}
