export async function onRequest(context) {
  const env = context.env || {};
  let history = [];
  if (env.SIGNALS_KV) {
    history = JSON.parse((await env.SIGNALS_KV.get("history")) || "[]");
  }
  return new Response(JSON.stringify({ history }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
