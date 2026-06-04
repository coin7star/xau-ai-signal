const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return j({ ok: false, error: "ENV FIREBASE_DATABASE_URL belum diset" }, 500);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "full";
    const rawData = await fbGet(dbUrl, "/xauusd/latest");

    if (!rawData) {
      return j({
        ok: false,
        mode: "waiting-mt5-data",
        message: "Belum ada data MT5 di Firebase."
      }, 200, cacheHeaders(10));
    }

    if (mode === "lite") {
      return j(toMarketLite(rawData), 200, cacheHeaders(6));
    }

    const m1Limit = clampNumber(url.searchParams.get("m1"), 60, 30, 120);
    const m15Limit = clampNumber(url.searchParams.get("m15"), 0, 0, 0);

    return j(toMarketChart(rawData, m1Limit, m15Limit), 200, cacheHeaders(20));
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return j({ ok: false, error: "Body JSON tidak valid" }, 400); }

    const envToken = env.MT5_INGEST_TOKEN || "";
    const mt5Token = body.token || "";

    if (!envToken) return j({ ok: false, error: "ENV MT5_INGEST_TOKEN belum diset" }, 500);
    if (mt5Token !== envToken) return j({ ok: false, error: "Unauthorized: token MT5 salah" }, 401);

    const symbol = body.symbol || "XAUUSD";
    const candles = Array.isArray(body.candles) ? body.candles.slice(-180) : [];
    // Step 10AQ: M15 chart/OB disembunyikan agar payload RTDB lebih ringan.
    const candlesM15 = [];

    const payload = {
      ok: true,
      source: "mt5",
      symbol,
      timeframe: body.timeframe || "M1",
      obTimeframe: "M5_ONLY",
      bid: Number(body.bid || 0),
      ask: Number(body.ask || 0),
      digits: Number(body.digits || 2),
      serverTime: body.serverTime || null,
      receivedAt: new Date().toISOString(),
      candles,
      candlesM15: []
    };

    await fbPut(dbUrl, "/xauusd/latest", payload);

    return j({
      ok: true,
      message: "Market data saved to Firebase (RTDB Lite Mode)",
      symbol,
      candleCount: candles.length,
      candleM15Count: 0,
      receivedAt: payload.receivedAt
    });
  }

  return j({ ok: false, error: `Method ${request.method} not allowed` }, 405);
}


function toMarketLite(data) {
  const candles = Array.isArray(data.candles) ? data.candles : [];
  const candlesM15 = [];
  const last = candles[candles.length - 1] || null;

  return {
    ok: true,
    source: data.source || "mt5",
    mode: "lite",
    symbol: data.symbol || "XAUUSD",
    timeframe: data.timeframe || "M1",
    obTimeframe: "M5_ONLY",
    bid: Number(data.bid || 0),
    ask: Number(data.ask || 0),
    digits: Number(data.digits || 2),
    serverTime: data.serverTime || null,
    receivedAt: data.receivedAt || null,
    lastClose: Number(last?.close || data.bid || 0),
    lastCandleTime: last?.time || null,
    m1Count: candles.length,
    m15Count: candlesM15.length
  };
}

function toMarketChart(data, m1Limit = 80, m15Limit = 60) {
  const candles = Array.isArray(data.candles) ? data.candles.slice(-m1Limit) : [];
  const candlesM15 = [];
  const candlesM5 = aggregateCandlesToM5(Array.isArray(data.candles) ? data.candles : []).slice(-90);

  return {
    ...toMarketLite(data),
    mode: "chart",
    candles,
    candlesM5,
    candlesM15: [],
    m5Count: candlesM5.length
  };
}

function aggregateCandlesToM5(candles) {
  const input = Array.isArray(candles) ? candles : [];
  if (input.length < 5) return [];
  const groups = [];
  let current = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const t = Date.parse(c.time || c.datetime || c.timestamp || "");
    let key;
    if (Number.isFinite(t)) {
      const d = new Date(t);
      d.setUTCSeconds(0, 0);
      d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5);
      key = d.toISOString();
    } else {
      key = `idx_${Math.floor(i / 5)}`;
    }
    const open = Number(c.open), high = Number(c.high), low = Number(c.low), close = Number(c.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    if (!current || current.key !== key) {
      if (current) groups.push(current);
      current = { key, time: key.startsWith("idx_") ? c.time : key, open, high, low, close, volume: Number(c.volume || c.tick_volume || 0), sourceCount: 1 };
    } else {
      current.high = Math.max(current.high, high);
      current.low = Math.min(current.low, low);
      current.close = close;
      current.volume += Number(c.volume || c.tick_volume || 0);
      current.sourceCount += 1;
      current.time = key.startsWith("idx_") ? c.time : key;
    }
  }
  if (current) groups.push(current);
  return groups.slice(-160);
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cacheHeaders(seconds = 10) {
  return {
    ...H,
    "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=15`
  };
}


async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
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

function j(payload, status = 200, headers = { ...H, "Cache-Control": "no-store" }) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}
