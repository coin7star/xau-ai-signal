export async function onRequest(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!env.SIGNALS_KV) {
    return json({ ok: false, error: "KV binding SIGNALS_KV belum aktif" }, 500, headers);
  }

  if (request.method === "GET") {
    const raw = await env.SIGNALS_KV.get("market:XAUUSD:latest");
    if (!raw) {
      return json({
        ok: false,
        mode: "waiting-mt5-data",
        message: "Belum ada data dari MT5. Jalankan EA XAU_Web_Data_Sender dulu."
      }, 200, headers);
    }

    return new Response(raw, { status: 200, headers });
  }

  if (request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch (err) {
      return json({ ok: false, error: "Body JSON tidak valid" }, 400, headers);
    }

    const tokenFromMt5 = body.token || "";
    const tokenFromEnv = env.MT5_INGEST_TOKEN || "";

    if (!tokenFromEnv) {
      return json({ ok: false, error: "ENV MT5_INGEST_TOKEN belum diset di Cloudflare" }, 500, headers);
    }

    if (tokenFromMt5 !== tokenFromEnv) {
      return json({ ok: false, error: "Unauthorized: token MT5 salah" }, 401, headers);
    }

    const symbol = body.symbol || "XAUUSD";
    const data = {
      ok: true,
      source: "mt5",
      symbol,
      timeframe: body.timeframe || "M1",
      bid: Number(body.bid || 0),
      ask: Number(body.ask || 0),
      digits: Number(body.digits || 2),
      serverTime: body.serverTime || null,
      receivedAt: new Date().toISOString(),
      candles: Array.isArray(body.candles) ? body.candles.slice(-300) : []
    };

    await env.SIGNALS_KV.put("market:XAUUSD:latest", JSON.stringify(data));
    await env.SIGNALS_KV.put(`market:${symbol}:latest`, JSON.stringify(data));

    return json({
      ok: true,
      message: "Market data saved to KV",
      symbol,
      candleCount: data.candles.length,
      receivedAt: data.receivedAt
    }, 200, headers);
  }

  return json({ ok: false, error: `Method ${request.method} not allowed` }, 405, headers);
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers
  });
}
