const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

export async function onRequest({ env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diset di Cloudflare ENV"
    }, 500);
  }

  const text = [
    "🟢 <b>XAU AI PREMIUM ALERT TEST</b>",
    "<i>Premium notification gateway sudah aktif.</i>",
    "",
    "<b>Signal:</b> TEST MODE",
    "<b>Pair:</b> XAUUSD+",
    "<b>Confidence:</b> 100% · Gateway Check",
    "",
    "🚀 <b>Status</b>",
    "Premium alert channel siap menerima MAIN CALL berikutnya.",
    "",
    "<i>Bukan financial advice.</i>"
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  let response = null;
  try { response = await res.json(); } catch { response = await res.text(); }

  return json({ ok: res.ok, status: res.status, response }, res.ok ? 200 : 500);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: H });
}
