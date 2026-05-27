const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-app-secret"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    try {
      if (url.pathname === "/api/health") return json({ ok: true, name: "XAU AI Signal GenZ" });

      if (url.pathname === "/api/signal" && request.method === "GET") {
        const symbol = cleanSymbol(url.searchParams.get("symbol") || "XAUUSD");
        const raw = await env.SIGNALS_KV.get(`latest:${symbol}`);
        if (!raw) return json({ ok: true, empty: true, message: "Belum ada sinyal. Jalankan EA MT5 dulu." });
        return json({ ok: true, signal: JSON.parse(raw) });
      }

      if (url.pathname === "/api/history" && request.method === "GET") {
        const symbol = cleanSymbol(url.searchParams.get("symbol") || "XAUUSD");
        const raw = await env.SIGNALS_KV.get(`history:${symbol}`);
        return json({ ok: true, history: raw ? JSON.parse(raw) : [] });
      }

      if (url.pathname === "/api/mt5/tick" && request.method === "POST") {
        assertSecret(request, env);
        const body = await safeJson(request);
        const snapshot = normalizeSnapshot(body);
        const signal = await createAiSignal(snapshot, env);
        await saveSignal(signal, env);
        return json({ ok: true, signal });
      }

      if (url.pathname === "/api/manual-signal" && request.method === "POST") {
        assertSecret(request, env);
        const body = await safeJson(request);
        const snapshot = normalizeSnapshot(body);
        const signal = await createAiSignal(snapshot, env);
        await saveSignal(signal, env);
        return json({ ok: true, signal });
      }

      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ ok: false, error: err.message || "Unknown error" }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: jsonHeaders });
}

function assertSecret(request, env) {
  const got = request.headers.get("x-app-secret") || "";
  if (!env.APP_SECRET || got !== env.APP_SECRET) throw new Error("Unauthorized: APP_SECRET salah.");
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Body harus JSON.");
  }
}

function cleanSymbol(symbol) {
  return String(symbol || "XAUUSD").toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 20);
}

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeSnapshot(body) {
  const symbol = cleanSymbol(body.symbol || "XAUUSD");
  const bid = n(body.bid);
  const ask = n(body.ask);
  const mid = bid && ask ? (bid + ask) / 2 : n(body.price || body.close);
  if (!mid) throw new Error("Harga tidak valid. Kirim bid/ask atau price.");

  return {
    symbol,
    timeframe: String(body.timeframe || "M5").slice(0, 10),
    bid,
    ask,
    price: Number(mid.toFixed(3)),
    rsi: n(body.rsi, 50),
    emaFast: n(body.emaFast, mid),
    emaSlow: n(body.emaSlow, mid),
    atr: n(body.atr, 2),
    spreadPoints: n(body.spreadPoints, 0),
    candleTrend: String(body.candleTrend || "unknown").slice(0, 30),
    note: String(body.note || "").slice(0, 500),
    receivedAt: new Date().toISOString()
  };
}

async function createAiSignal(snapshot, env) {
  const fallback = ruleBasedSignal(snapshot, "AI API belum aktif / gagal, memakai fallback rule-based.");
  if (!env.AI_API_URL || !env.AI_API_KEY || !env.AI_MODEL) return fallback;

  const prompt = [
    "Kamu adalah analis teknikal XAUUSD yang super disiplin risk management.",
    "Balas JSON valid saja tanpa markdown.",
    "Gunakan data snapshot berikut. Jangan mengarang data market lain.",
    "Action hanya BUY, SELL, atau WAIT.",
    "Jika spread besar, ATR tidak jelas, RSI netral, atau confidence rendah, pilih WAIT.",
    "Gunakan SL/TP realistis dari ATR. Confidence 0-100.",
    "JSON schema:",
    '{"symbol":"XAUUSD","action":"BUY|SELL|WAIT","confidence":0,"entry":0,"stopLoss":0,"takeProfit1":0,"takeProfit2":0,"reason":"...","riskNote":"..."}',
    "Snapshot:",
    JSON.stringify(snapshot)
  ].join("\n");

  try {
    const res = await fetch(env.AI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!res.ok) throw new Error(`AI API error ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const ai = JSON.parse(content);
    return sanitizeSignal(ai, snapshot, "AI");
  } catch (e) {
    return ruleBasedSignal(snapshot, `AI gagal: ${e.message}. Memakai fallback rule-based.`);
  }
}

function sanitizeSignal(ai, snapshot, source) {
  const action = ["BUY", "SELL", "WAIT"].includes(String(ai.action).toUpperCase())
    ? String(ai.action).toUpperCase()
    : "WAIT";

  const signal = {
    id: crypto.randomUUID(),
    source,
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    action,
    confidence: Math.max(0, Math.min(100, Math.round(n(ai.confidence, 0)))),
    entry: roundPrice(n(ai.entry, snapshot.price)),
    stopLoss: roundPrice(n(ai.stopLoss, 0)),
    takeProfit1: roundPrice(n(ai.takeProfit1, 0)),
    takeProfit2: roundPrice(n(ai.takeProfit2, 0)),
    reason: String(ai.reason || "Tidak ada alasan.").slice(0, 500),
    riskNote: String(ai.riskNote || "Gunakan risiko kecil dan validasi manual.").slice(0, 500),
    snapshot,
    createdAt: new Date().toISOString()
  };

  if (signal.action === "WAIT") {
    signal.stopLoss = 0;
    signal.takeProfit1 = 0;
    signal.takeProfit2 = 0;
  }

  return signal;
}

function ruleBasedSignal(s, note) {
  const trendUp = s.emaFast > s.emaSlow;
  const trendDown = s.emaFast < s.emaSlow;
  const rsiBuy = s.rsi >= 52 && s.rsi <= 68;
  const rsiSell = s.rsi <= 48 && s.rsi >= 32;
  const spreadOk = s.spreadPoints <= 80 || s.spreadPoints === 0;
  const atr = Math.max(s.atr, 1);
  let action = "WAIT";
  let confidence = 45;

  if (trendUp && rsiBuy && spreadOk) {
    action = "BUY";
    confidence = 68;
  } else if (trendDown && rsiSell && spreadOk) {
    action = "SELL";
    confidence = 68;
  }

  const entry = s.price;
  const stopLoss = action === "BUY" ? entry - atr * 1.2 : action === "SELL" ? entry + atr * 1.2 : 0;
  const takeProfit1 = action === "BUY" ? entry + atr * 1.2 : action === "SELL" ? entry - atr * 1.2 : 0;
  const takeProfit2 = action === "BUY" ? entry + atr * 2.0 : action === "SELL" ? entry - atr * 2.0 : 0;

  return sanitizeSignal({
    action,
    confidence,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    reason: action === "WAIT"
      ? `Market belum cakep buat entry. ${note}`
      : `Trend EMA + RSI mendukung ${action}. ${note}`,
    riskNote: "Maks risiko 0.5%-1% per posisi. Hindari entry saat news besar."
  }, s, "RULE");
}

function roundPrice(x) {
  return Number(n(x).toFixed(3));
}

async function saveSignal(signal, env) {
  const symbol = signal.symbol;
  await env.SIGNALS_KV.put(`latest:${symbol}`, JSON.stringify(signal));

  const key = `history:${symbol}`;
  const raw = await env.SIGNALS_KV.get(key);
  const history = raw ? JSON.parse(raw) : [];
  history.unshift(signal);
  await env.SIGNALS_KV.put(key, JSON.stringify(history.slice(0, 50)));
}
