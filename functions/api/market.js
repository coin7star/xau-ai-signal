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
    const nowIso = new Date().toISOString();
    const rawCandles = Array.isArray(body.candles) ? body.candles : [];
    const closedFromBody = body.lastClosedCandle || body.closedCandle || body.m1ClosedCandle || body.lastClosedM1 || null;

    // Step 10BP:
    // EA v2.2 mengirim latest price setiap 1-2 detik, tapi full candle array hanya saat M1 close / force sync.
    // Jangan overwrite /xauusd/latest.candles menjadi hanya 1 candle saat packet latest-only masuk.
    const previousData = await fbGet(dbUrl, "/xauusd/latest");
    const previousCandles = Array.isArray(previousData?.candles) ? previousData.candles : [];
    const isFullCandlePacket = body.sendFullCandles === true || rawCandles.length >= 20;
    const candleSource = isFullCandlePacket ? rawCandles : previousCandles;
    const candles = normalizeClosedM1Candles(candleSource, closedFromBody, body.serverTime || body.time || nowIso).slice(-180);
    const lastClosed = candles[candles.length - 1] || normalizeCandle(closedFromBody) || previousData?.lastClosedCandle || null;
    // Step 10AQ: M15 chart/OB disembunyikan agar payload RTDB lebih ringan.
    const candlesM15 = [];

    const bid = Number(body.bid || body.lastPrice || body.price || previousData?.bid || 0);
    const ask = Number(body.ask || body.lastPrice || body.price || previousData?.ask || bid || 0);
    const lastPrice = Number(body.lastPrice || body.price || body.close || previousData?.lastPrice || previousData?.price || ((bid && ask) ? (bid + ask) / 2 : bid || ask || 0));

    const payload = {
      ...(previousData && typeof previousData === "object" ? previousData : {}),
      ok: true,
      source: "mt5",
      symbol,
      rawSymbol: body.rawSymbol || symbol,
      timeframe: body.timeframe || previousData?.timeframe || "M1",
      obTimeframe: "M5_ONLY",
      bid,
      ask,
      lastPrice,
      price: lastPrice,
      spreadPoints: Number(body.spreadPoints ?? previousData?.spreadPoints ?? 0),
      digits: Number(body.digits || previousData?.digits || 2),
      serverTime: body.serverTime || previousData?.serverTime || null,
      serverTimeUnix: Number(body.serverTimeUnix || previousData?.serverTimeUnix || 0),
      receivedAt: nowIso,
      tickUpdatedAt: nowIso,
      lastClosedCandle: lastClosed,
      lastClosedCandleTime: lastClosed?.time || previousData?.lastClosedCandleTime || null,
      lastClosedCandleTimeUnix: Number(body.lastClosedCandleTimeUnix || previousData?.lastClosedCandleTimeUnix || 0),
      candleSync: buildCandleSyncMeta({ candles, serverTime: body.serverTime || nowIso, receivedAt: nowIso }),
      candles,
      candlesM15: []
    };

    await fbPut(dbUrl, "/xauusd/latest", payload);

    return j({
      ok: true,
      message: isFullCandlePacket
        ? "Market full candles saved to Firebase (RTDB Lite Mode)"
        : "Market latest price saved, previous candles preserved (RTDB Lite Mode)",
      symbol,
      candleCount: candles.length,
      candleM15Count: 0,
      packet: isFullCandlePacket ? "full-candles" : "latest-only-preserve-candles",
      receivedAt: payload.receivedAt
    });
  }

  return j({ ok: false, error: `Method ${request.method} not allowed` }, 405);
}


function toMarketLite(data) {
  const candles = normalizeClosedM1Candles(Array.isArray(data.candles) ? data.candles : [], data.lastClosedCandle || null, data.serverTime || data.receivedAt || null);
  const candlesM15 = [];
  const last = data.lastClosedCandle || candles[candles.length - 1] || null;
  const sync = buildCandleSyncMeta({ candles, serverTime: data.serverTime || data.receivedAt, receivedAt: data.receivedAt });
  const bid = Number(data.bid || data.lastPrice || data.price || 0);
  const ask = Number(data.ask || data.lastPrice || data.price || bid || 0);
  const lastPrice = Number(data.lastPrice || data.price || last?.close || ((bid && ask) ? (bid + ask) / 2 : bid || ask || 0));

  return {
    ok: true,
    source: data.source || "mt5",
    mode: "lite",
    symbol: data.symbol || "XAUUSD",
    timeframe: data.timeframe || "M1",
    obTimeframe: "M5_ONLY",
    bid,
    ask,
    lastPrice,
    price: lastPrice,
    digits: Number(data.digits || 2),
    serverTime: data.serverTime || null,
    receivedAt: data.receivedAt || null,
    tickUpdatedAt: data.tickUpdatedAt || data.receivedAt || null,
    lastClose: Number(last?.close || lastPrice || bid || 0),
    lastCandleTime: last?.time || data.lastClosedCandleTime || null,
    lastClosedCandle: last,
    candleSync: data.candleSync || sync,
    m1Count: candles.length,
    m15Count: candlesM15.length
  };
}

function toMarketChart(data, m1Limit = 80, m15Limit = 60) {
  const closedCandles = normalizeClosedM1Candles(Array.isArray(data.candles) ? data.candles : [], data.lastClosedCandle || null, data.serverTime || data.receivedAt || null);
  const candles = closedCandles.slice(-m1Limit);
  const candlesM15 = [];
  const candlesM5 = aggregateCandlesToM5(closedCandles).slice(-90);

  return {
    ...toMarketLite(data),
    mode: "chart",
    candles,
    candlesM5,
    candlesM15: [],
    m5Count: candlesM5.length
  };
}


function normalizeClosedM1Candles(candles = [], explicitClosed = null, referenceTime = null) {
  const valid = (Array.isArray(candles) ? candles : [])
    .map(normalizeCandle)
    .filter(Boolean);

  const closed = explicitClosed ? normalizeCandle(explicitClosed) : null;
  if (closed) {
    const idx = valid.findIndex((c) => String(c.time || "") === String(closed.time || ""));
    if (idx >= 0) valid[idx] = { ...valid[idx], ...closed };
    else valid.push(closed);
  }

  valid.sort((a, b) => parseCandleTimeMs(a.time) - parseCandleTimeMs(b.time));

  const refMs = parseCandleTimeMs(referenceTime) || Date.now();
  const out = [];
  for (const c of valid) {
    const candleMs = parseCandleTimeMs(c.time);
    // Jika timestamp valid, M1 candle baru dianggap closed setelah lewat 60 detik.
    // Ini mencegah candle running MT5 shift-0 ikut dihitung sebagai sinyal.
    if (candleMs && refMs && refMs < candleMs + 60000) continue;
    const last = out[out.length - 1];
    if (last && String(last.time || "") === String(c.time || "")) out[out.length - 1] = c;
    else out.push(c);
  }

  return out;
}

function normalizeCandle(c) {
  if (!c || typeof c !== "object") return null;
  const open = Number(c.open);
  const high = Number(c.high);
  const low = Number(c.low);
  const close = Number(c.close);
  if (![open, high, low, close].every(Number.isFinite)) return null;
  return {
    ...c,
    time: c.time || c.datetime || c.timestamp || null,
    open,
    high,
    low,
    close,
    volume: Number(c.volume || c.tick_volume || c.tickVolume || 0)
  };
}

function buildCandleSyncMeta({ candles = [], serverTime = null, receivedAt = null } = {}) {
  const last = candles[candles.length - 1] || null;
  const nowMs = Date.now();
  const tickMs = parseCandleTimeMs(receivedAt || serverTime) || nowMs;
  const candleMs = parseCandleTimeMs(last?.time);
  const closedCandleAgeSec = candleMs ? Math.max(0, Math.round((nowMs - (candleMs + 60000)) / 1000)) : null;
  const liveFeedAgeSec = tickMs ? Math.max(0, Math.round((nowMs - tickMs) / 1000)) : null;
  const status = !last
    ? "WAITING_CANDLE"
    : closedCandleAgeSec != null && closedCandleAgeSec <= 15
      ? "SYNCED"
      : closedCandleAgeSec != null && closedCandleAgeSec <= 75
        ? "OK"
        : "STALE_CANDLE";
  return {
    status,
    lastClosedCandleTime: last?.time || null,
    closedCandleAgeSec,
    liveFeedAgeSec,
    note: status === "SYNCED" ? "Candle M1 close sudah sinkron." : status === "OK" ? "Candle M1 close masih valid." : "Menunggu candle M1 close terbaru dari MT5."
  };
}

function parseCandleTimeMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value > 1000000000000 ? value : value * 1000;
  const raw = String(value).trim();
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric > 1000000000000 ? numeric : numeric * 1000;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
