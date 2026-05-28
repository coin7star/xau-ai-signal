const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const resendKey = env.RESEND_API_KEY || "";
  const emailFrom = env.EMAIL_FROM || "XAU AI Signal <onboarding@resend.dev>";

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);
  if (!resendKey) return json({ ok: false, error: "RESEND_API_KEY belum diset di Cloudflare ENV" }, 500);

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const uid = String(body.uid || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  if (!uid || !email || !email.includes("@")) {
    return json({ ok: false, error: "uid dan email wajib valid" }, 400);
  }

  const user = await fbGet(dbUrl, `/users/${uid}`);

  if (!user || String(user.email || "").toLowerCase() !== email) {
    return json({ ok: false, error: "User tidak cocok dengan email" }, 403);
  }

  if (user.emailCodeVerified || user.emailVerified) {
    return json({ ok: true, skipped: "already-verified" });
  }

  const code = createCode();
  const now = Date.now();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();

  await fbPut(dbUrl, `/emailCodes/${uid}`, {
    uid,
    email,
    code,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    used: false
  });

  const html = buildEmailHtml(code, expiresAt);
  const subject = `Kode Verifikasi XAU AI Signal: ${code}`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject,
      html
    })
  });

  if (!sendRes.ok) {
    const text = await sendRes.text();
    return json({ ok: false, error: "Gagal kirim email kode", detail: text }, 500);
  }

  const sent = await sendRes.json();

  return json({
    ok: true,
    message: "Kode verifikasi sudah dikirim",
    expiresAt,
    provider: "resend",
    id: sent?.id || null
  });
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildEmailHtml(code, expiresAt) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
    <h2>XAU AI Signal</h2>
    <p>Gunakan kode berikut untuk verifikasi email kamu:</p>
    <div style="font-size:32px;font-weight:900;letter-spacing:8px;background:#111827;color:#facc15;padding:18px 22px;border-radius:14px;width:max-content">
      ${code}
    </div>
    <p>Kode berlaku sampai: <b>${expiresAt}</b></p>
    <p>Kalau kamu tidak merasa daftar, abaikan email ini.</p>
    <p>Thanks,<br/>XAU AI Signal Team</p>
  </div>`;
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
  return await res.json();
}

async function fbPut(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
