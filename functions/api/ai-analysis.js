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
    return json({ ok: false, error: "ENV FIREBASE_DATABASE_URL belum diset" }, 500);
  }

  const marketRes = await fetch(`${dbUrl}/xauusd/latest.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });

  const market = marketRes.ok ? await marketRes.json() : null;
  const candles = Array.isArray(market?.candles) ? market.candles : [];
  const signal = buildSignal(candles, market);

  const fallback = buildFallbackAnalysis(market, signal);

  if (!env.AI_API_KEY) {
    return json({
      ok: true,
      mode: "fallback-no-ai-key",
      analysis: fallback,
      signal,
      updatedAt: new Date().toISOString()
    });
  }

  try {
    const ai = await callAI(env, market, signal);
    return json({
      ok: true,
      mode: "ai-live",
      analysis: normalizeAiText(ai) || fallback,
      signal,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return json({
      ok: true,
      mode: "fallback-ai-error",
      error: err.message || String(err),
      analysis: fallback,
      signal,
      updatedAt: new Date().toISOString()
    });
  }
}

async function callAI(env, market, signal) {
  const baseUrl = env.AI_BASE_URL || "https://api.groq.com/openai/v1/chat/completions";
  const model = env.AI_MODEL || "llama3-70b-8192";
  const candles = (market?.candles || []).slice(-35);

  const prompt = `
Kamu adalah AI analis XAUUSD untuk dashboard trading.
Jawab singkat, bahasa Indonesia santai tapi profesional.
Jangan memberi janji profit. Jangan overclaim. Sertakan disclaimer singkat.
Data:
Pair: ${market?.symbol || "XAUUSD"}
TF: ${market?.timeframe || "M1"}
Bid: ${market?.bid}
Ask: ${market?.ask}
Signal system: ${signal.signal}
Confidence: ${signal.confidence}
Entry: ${signal.entry}
SL: ${signal.sl}
TP: ${signal.tp}
RSI: ${signal.strategy?.rsi}
EMA9: ${signal.strategy?.ema9}
EMA20: ${signal.strategy?.ema20}
EMA Cross: ${signal.strategy?.emaCross}
Buy Score: ${signal.strategy?.buyScore}
Sell Score: ${signal.strategy?.sellScore}
Bullish OB: ${JSON.stringify(signal.strategy?.orderBlock?.bullish || null)}
Bearish OB: ${JSON.stringify(signal.strategy?.orderBlock?.bearish || null)}
Recent candles: ${JSON.stringify(candles)}

Format wajib:
Bias:
Alasan:
Area penting:
Rencana:
Risiko:
`.trim();

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Kamu analis market XAUUSD. Jawab ringkas, tidak halu, dan selalu sebut ini bukan financial advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.35,
      max_tokens: 450
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function normalizeAiText(text) {
  return String(text || "").trim().slice(0, 2400);
}

function buildFallbackAnalysis(market, signal) {
  const s = signal?.strategy || {};
  const obBull = s?.orderBlock?.bullish;
  const obBear = s?.orderBlock?.bearish;

  const bias = signal.signal === "BUY"
    ? "Bias condong BUY selama harga bertahan di atas area support terdekat."
    : signal.signal === "SELL"
      ? "Bias condong SELL selama harga tertahan di bawah resistance terdekat."
      : "Bias masih WAIT karena konfirmasi belum cukup kuat.";

  const obText = [
    obBull ? `Bullish OB ${obBull.low} - ${obBull.high}` : "Bullish OB belum jelas",
    obBear ? `Bearish OB ${obBear.low} - ${obBear.high}` : "Bearish OB belum jelas"
  ].join(". ");

  return [
    `Bias: ${bias}`,
    `Alasan: RSI ${s.rsi ?? "-"}, EMA Cross ${humanize(s.emaCross)}, Buy Score ${s.buyScore ?? "-"} vs Sell Score ${s.sellScore ?? "-"}.`,
    `Area penting: ${obText}.`,
    `Rencana: Ikuti sinyal ${signal.signal} hanya jika candle berikutnya tetap mendukung struktur market.`,
    `Risiko: XAUUSD volatil, gunakan lot kecil dan anggap ini bukan financial advice.`
  ].join("\n");
}

function humanize(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

function buildSignal(candles, market) {
  const cleanCandles = candles
    .map((c) => ({
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }))
    .filter((c) =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    );

  const closes = cleanCandles.map((c) => c.close);
  const last = cleanCandles[cleanCandles.length - 1];

  if (!last || closes.length < 35) {
    return {
      ok: true,
      pair: "XAUUSD",
      signal: "WAIT",
      entry: round(market?.bid || 0),
      sl: 0,
      tp: 0,
      confidence: 50,
      reason: "Menunggu minimal 35 candle.",
      mode: market ? "firebase-mt5-data" : "waiting-mt5",
      strategy: {
        trendBias: "Netral",
        rsi: null,
        ema9: null,
        ema20: null,
        emaCross: "WAIT",
        orderBlock: null,
        buyScore: 0,
        sellScore: 0,
        score: 0
      }
    };
  }

  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const prevEma9 = ema(closes.slice(0, -1), 9);
  const prevEma20 = ema(closes.slice(0, -1), 20);
  const rsi14 = rsiWilder(closes, 14);
  const atr14 = atr(cleanCandles, 14);

  const close = Number(last.close);
  const high = Number(last.high);
  const low = Number(last.low);

  const orderBlock = detectOrderBlock(cleanCandles);
  const bullOb = orderBlock.bullish;
  const bearOb = orderBlock.bearish;

  const nearBullOB = bullOb && close >= bullOb.low - atr14 * 0.3 && close <= bullOb.high + atr14 * 0.8;
  const nearBearOB = bearOb && close <= bearOb.high + atr14 * 0.3 && close >= bearOb.low - atr14 * 0.8;

  let emaCross = "NEUTRAL";
  if (prevEma9 <= prevEma20 && ema9 > ema20) emaCross = "BULLISH_CROSS";
  else if (prevEma9 >= prevEma20 && ema9 < ema20) emaCross = "BEARISH_CROSS";
  else if (ema9 > ema20) emaCross = "BULLISH_TREND";
  else if (ema9 < ema20) emaCross = "BEARISH_TREND";

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (ema9 > ema20) { buyScore += 25; reasons.push("EMA 9 di atas EMA 20, trend pendek bullish."); }
  if (ema9 < ema20) { sellScore += 25; reasons.push("EMA 9 di bawah EMA 20, trend pendek bearish."); }

  if (emaCross === "BULLISH_CROSS") { buyScore += 25; reasons.push("EMA 9 baru cross ke atas EMA 20."); }
  if (emaCross === "BEARISH_CROSS") { sellScore += 25; reasons.push("EMA 9 baru cross ke bawah EMA 20."); }

  if (rsi14 >= 55 && rsi14 <= 72) { buyScore += 20; reasons.push(`RSI Wilder ${round(rsi14)} mendukung BUY.`); }
  if (rsi14 <= 45 && rsi14 >= 28) { sellScore += 20; reasons.push(`RSI Wilder ${round(rsi14)} mendukung SELL.`); }
  if (rsi14 > 72) { sellScore += 8; reasons.push(`RSI Wilder ${round(rsi14)} mulai overbought.`); }
  if (rsi14 < 28) { buyScore += 8; reasons.push(`RSI Wilder ${round(rsi14)} mulai oversold.`); }

  if (nearBullOB) { buyScore += 22; reasons.push("Harga dekat bullish order block."); }
  if (nearBearOB) { sellScore += 22; reasons.push("Harga dekat bearish order block."); }

  if (close > high - atr14 * 0.35) buyScore += 8;
  if (close < low + atr14 * 0.35) sellScore += 8;

  let finalSignal = "WAIT";
  const score = Math.max(buyScore, sellScore);

  if (buyScore >= 55 && buyScore > sellScore + 8) finalSignal = "BUY";
  else if (sellScore >= 55 && sellScore > buyScore + 8) finalSignal = "SELL";

  const entry = close;
  let sl = 0;
  let tp = 0;

  if (finalSignal === "BUY") {
    sl = bullOb ? Math.min(bullOb.low, close - atr14 * 1.1) : close - atr14 * 1.4;
    tp = close + Math.abs(close - sl) * 1.7;
  } else if (finalSignal === "SELL") {
    sl = bearOb ? Math.max(bearOb.high, close + atr14 * 1.1) : close + atr14 * 1.4;
    tp = close - Math.abs(sl - close) * 1.7;
  }

  const confidence = finalSignal === "WAIT"
    ? Math.min(62, Math.max(45, Math.round(score)))
    : Math.min(94, Math.max(60, Math.round(score)));

  const trendBias = ema9 > ema20 ? "Bullish" : ema9 < ema20 ? "Bearish" : "Netral";

  return {
    ok: true,
    pair: "XAUUSD",
    signal: finalSignal,
    entry: round(entry),
    sl: round(sl),
    tp: round(tp),
    confidence,
    reason: reasons.slice(0, 5).join(" "),
    mode: "firebase-mt5-data",
    strategy: {
      trendBias,
      rsi: round(rsi14),
      ema9: round(ema9),
      ema20: round(ema20),
      emaCross,
      orderBlock,
      buyScore: round(buyScore),
      sellScore: round(sellScore),
      score: round(score)
    }
  };
}

function ema(values, period) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = values[i] * k + result * (1 - k);
  return result;
}

function rsiWilder(values, period = 14) {
  if (values.length <= period) return 50;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr(candles, period = 14) {
  if (candles.length < 2) return 1;
  const slice = candles.slice(-period - 1);
  const trs = [];
  for (let i = 1; i < slice.length; i++) {
    const current = slice[i];
    const prev = slice[i - 1];
    const high = Number(current.high);
    const low = Number(current.low);
    const prevClose = Number(prev.close);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const sum = trs.reduce((a, b) => a + b, 0);
  return trs.length ? sum / trs.length : 1;
}

function detectOrderBlock(candles) {
  const scan = candles.slice(-80);
  let bullish = null;
  let bearish = null;

  for (let i = 3; i < scan.length - 3; i++) {
    const c = scan[i];
    const next2 = scan[i + 2];
    const open = Number(c.open);
    const close = Number(c.close);
    const high = Number(c.high);
    const low = Number(c.low);
    const nextMoveUp = Number(next2.close) > high;
    const nextMoveDown = Number(next2.close) < low;
    const bearishCandle = close < open;
    const bullishCandle = close > open;

    if (bearishCandle && nextMoveUp) {
      bullish = { type: "Bullish OB", low: round(low), high: round(high), originTime: c.time || null };
    }
    if (bullishCandle && nextMoveDown) {
      bearish = { type: "Bearish OB", low: round(low), high: round(high), originTime: c.time || null };
    }
  }

  return { bullish, bearish };
}

function round(n) {
  return Number(Number(n || 0).toFixed(2));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
