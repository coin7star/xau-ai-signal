const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export async function onRequest(context) {
  try {
    const { env } = context
    if (!env.SIGNALS_KV) {
      return new Response(JSON.stringify({ items: [], message: 'KV SIGNALS_KV belum dipasang.' }), { headers })
    }

    const list = await env.SIGNALS_KV.list({ prefix: 'signal:', limit: 20 })
    const items = []
    for (const key of list.keys.reverse()) {
      const value = await env.SIGNALS_KV.get(key.name)
      if (value) items.push(JSON.parse(value))
    }

    return new Response(JSON.stringify({ items }, null, 2), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
