function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function fallbackSignal() {
  const isBuy = Math.random() > 0.5;
  const entry = +(2320 + Math.random() * 80).toFixed(2);
  const risk = +(6 + Math.random() * 5).toFixed(2);
  const reward = +(risk * 1.8).toFixed(2);
  return {
    pair: "XAUUSD",
    signal: isBuy ? "BUY" : "SELL",
    entry: String(entry),
    sl: String(isBuy ? +(entry - risk).toFixed(2) : +(entry + risk).toFixed(2)),
    tp: String(isBuy ? +(entry + reward).toFixed(2) : +(entry - reward).toFixed(2)),
    confidence: `${Math.floor(70 + Math.random() * 23)}%`,
    reason: "Fallback mode: belum pakai live market feed. Gunakan sebagai demo UI/API dulu, bukan entry real.",
    mode: "fallback-demo",
    time: new Date().toISOString(),
  };
}

async function askGroq(env) {
  if (!env.AI_API_KEY) return null;
  const model = env.AI_MODEL || "llama3-70b-8192";
  const prompt = `Buat 1 sinyal trading XAUUSD dalam JSON valid saja. Field wajib: pair, signal BUY/SELL/WAIT, entry, sl, tp, confidence, reason. Jangan markdown. Ini untuk demo edukasi, wajib konservatif.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Kamu analis trading XAUUSD. Output hanya JSON valid." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function onRequest(context) {
  try {
    const env = context.env || {};
    let signal = await askGroq(env).catch(() => null);
    if (!signal) signal = fallbackSignal();

    signal = {
      pair: signal.pair || "XAUUSD",
      signal: signal.signal || "WAIT",
      entry: String(signal.entry || "-"),
      sl: String(signal.sl || "-"),
      tp: String(signal.tp || "-"),
      confidence: String(signal.confidence || "0%"),
      reason: signal.reason || "AI signal generated.",
      mode: env.AI_API_KEY ? "ai" : "fallback-demo",
      time: new Date().toISOString(),
    };

    if (env.SIGNALS_KV) {
      const old = JSON.parse((await env.SIGNALS_KV.get("history")) || "[]");
      old.unshift(signal);
      await env.SIGNALS_KV.put("latest", JSON.stringify(signal));
      await env.SIGNALS_KV.put("history", JSON.stringify(old.slice(0, 50)));
    }

    return json(signal);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
