export async function onRequest({ env }) {
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return j({ ok: false, history: [] });
  const res = await fetch(`${dbUrl}/xauusd/latest.json`);
  const latest = res.ok ? await res.json() : null;
  return j({ ok: true, history: latest ? [latest] : [] });
}
function j(payload){ return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
