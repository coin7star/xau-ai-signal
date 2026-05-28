const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

export async function onRequest({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diset" }, 500);
  }

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || "";
  const envSecret = env.TELEGRAM_WEBHOOK_SECRET || "";

  if (envSecret && secret !== envSecret) {
    return json({ ok: false, error: "Secret salah" }, 401);
  }

  const origin = url.origin;
  const webhookUrl = `${origin}/api/telegram-webhook`;

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"]
    })
  });

  let response = null;
  try { response = await res.json(); } catch { response = await res.text(); }

  return json({
    ok: res.ok,
    webhookUrl,
    status: res.status,
    response,
    next: "Kalau ok true, coba kirim /start ke bot Telegram."
  }, res.ok ? 200 : 500);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: H
  });
}
