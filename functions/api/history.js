export async function onRequest({ env }) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");

  if (!dbUrl) {
    return json({ ok: false, history: [] });
  }

  const res = await fetch(`${dbUrl}/xauusd/latest.json`);
  const latest = res.ok ? await res.json() : null;

  return json({ ok: true, history: latest ? [latest] : [] });
}

function json(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
