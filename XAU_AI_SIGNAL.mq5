const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: corsHeaders })
}

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function fallbackSignal() {
  const base = 2350 + Math.random() * 20
  const isBuy = Math.random() > 0.5
  const entry = Number(base.toFixed(2))
  const sl = Number((isBuy ? entry - 8 : entry + 8).toFixed(2))
  const tp1 = Number((isBuy ? entry + 8 : entry - 8).toFixed(2))
  const tp2 = Number((isBuy ? entry + 14 : entry - 14).toFixed(2))
  return {
    pair: 'XAUUSD',
    signal: isBuy ? 'BUY' : 'SELL',
    entry,
    sl,
    tp1,
    tp2,
    confidence: 72,
    reason: 'Fallback demo signal. Pasang AI_API_KEY supaya analisa AI aktif.',
    mode: 'fallback-demo',
    createdAt: new Date().toISOString(),
  }
}

async function askAI(env, marketText) {
  if (!env.AI_API_KEY) return fallbackSignal()

  const model = env.AI_MODEL || 'llama3-70b-8192'
  const prompt = `Kamu analis XAUUSD. Buat 1 sinyal scalping singkat.
Balas JSON valid saja tanpa markdown.
Format:
{"pair":"XAUUSD","signal":"BUY/SELL/WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"confidence":number,"reason":"alasan singkat"}
Data market/user: ${marketText || 'Tidak ada data realtime. Gunakan analisa konservatif.'}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Jawab hanya JSON valid. Jangan memberi jaminan profit.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 350,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ...fallbackSignal(), aiError: text.slice(0, 300) }
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content || '{}'
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  return {
    pair: parsed.pair || 'XAUUSD',
    signal: ['BUY', 'SELL', 'WAIT'].includes(parsed.signal) ? parsed.signal : 'WAIT',
    entry: safeNumber(parsed.entry, 2350),
    sl: safeNumber(parsed.sl, 2340),
    tp1: safeNumber(parsed.tp1, 2360),
    tp2: safeNumber(parsed.tp2, 2370),
    confidence: Math.min(99, Math.max(1, safeNumber(parsed.confidence, 70))),
    reason: String(parsed.reason || 'AI signal generated.').slice(0, 240),
    mode: 'ai',
    createdAt: new Date().toISOString(),
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequest(context) {
  try {
    const { request, env } = context
    const url = new URL(request.url)
    const marketText = url.searchParams.get('market') || ''

    const signal = await askAI(env, marketText)

    if (env.SIGNALS_KV) {
      const key = `signal:${Date.now()}`
      await env.SIGNALS_KV.put(key, JSON.stringify(signal), { expirationTtl: 60 * 60 * 24 * 7 })
      await env.SIGNALS_KV.put('latest', JSON.stringify(signal), { expirationTtl: 60 * 60 * 24 * 7 })
    }

    return json(signal)
  } catch (err) {
    return json({ error: true, message: err.message, ...fallbackSignal() }, 200)
  }
}
