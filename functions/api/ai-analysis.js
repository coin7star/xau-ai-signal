export async function onRequest({ env }) {
  const fallback = [
    "Status: AI Analysis aktif.",
    "Konfirmasi: endpoint ini tetap fallback kalau AI_API_KEY belum diset.",
    "Rencana: Telegram CALL dikirim dari /api/signal saat callStage = CALL.",
    "Risiko: XAUUSD volatil. Ini bukan financial advice."
  ].join("\n");

  return json({
    ok: true,
    mode: env.AI_API_KEY ? "fallback-light" : "fallback-no-ai-key",
    analysis: fallback,
    updatedAt: new Date().toISOString()
  });
}

function json(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
