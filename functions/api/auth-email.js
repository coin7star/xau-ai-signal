
const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const type = String(body.type || "").toLowerCase();
  const email = String(body.email || "").trim();
  const idToken = String(body.idToken || "").trim();

  const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
  const resendKey = env.RESEND_API_KEY || "";
  const from = env.EMAIL_FROM || "XAU AI Signal <onboarding@resend.dev>";
  const appUrl = (env.APP_URL || "https://xau-ai-signal.pages.dev").replace(/\/$/, "");

  if (!apiKey) return json({ ok: false, error: "FIREBASE_WEB_API_KEY belum diset di Cloudflare." }, 500);
  if (!resendKey) return json({ ok: false, error: "RESEND_API_KEY belum diset di Cloudflare." }, 500);
  if (!email && type === "reset") return json({ ok: false, error: "Email wajib diisi." }, 400);
  if (!idToken && type === "verify") return json({ ok: false, error: "idToken wajib untuk verify email." }, 400);
  if (!["verify", "reset"].includes(type)) return json({ ok: false, error: "type harus verify atau reset." }, 400);

  try {
    const oobLink = await createFirebaseActionLink({ type, email, idToken, apiKey, appUrl });
    const customLink = toCustomActionLink(oobLink, appUrl);

    const subject = type === "verify"
      ? "Verifikasi email XAU AI Signal"
      : "Reset password XAU AI Signal";

    const html = type === "verify"
      ? buildVerifyEmailHtml({ link: customLink })
      : buildResetPasswordHtml({ link: customLink });

    const sendResult = await sendResendEmail({ resendKey, from, to: email, subject, html });

    return json({
      ok: true,
      type,
      email,
      message: type === "verify" ? "Email verifikasi branded terkirim." : "Email reset password branded terkirim.",
      resendId: sendResult?.id || null
    });
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
}

async function createFirebaseActionLink({ type, email, idToken, apiKey, appUrl }) {
  const requestType = type === "verify" ? "VERIFY_EMAIL" : "PASSWORD_RESET";

  const payload = {
    requestType,
    continueUrl: `${appUrl}/auth-action`,
    canHandleCodeInApp: true,
    returnOobLink: true
  };

  if (type === "verify") payload.idToken = idToken;
  if (type === "reset") payload.email = email;

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `Firebase OOB error ${res.status}`;
    throw new Error(cleanFirebaseRestError(msg));
  }

  const link = data.oobLink || data.ooblink || data.emailLink || "";

  if (!link) {
    throw new Error("Firebase tidak mengembalikan oobLink. Cek API key / Auth settings.");
  }

  return link;
}

function toCustomActionLink(oobLink, appUrl) {
  const url = new URL(oobLink);
  const mode = url.searchParams.get("mode");
  const oobCode = url.searchParams.get("oobCode");
  const apiKey = url.searchParams.get("apiKey") || "";

  if (!mode || !oobCode) return oobLink;

  const custom = new URL(`${appUrl}/auth-action`);
  custom.searchParams.set("mode", mode);
  custom.searchParams.set("oobCode", oobCode);
  if (apiKey) custom.searchParams.set("apiKey", apiKey);
  return custom.toString();
}

async function sendResendEmail({ resendKey, from, to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Resend error ${res.status}`);
  }

  return data;
}

function buildBaseHtml({ title, subtitle, buttonText, link, note }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#060814;font-family:Arial,Helvetica,sans-serif;color:#f8fbff;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(135deg,#160b33,#032f36);padding:36px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:rgba(10,16,31,.92);border:1px solid rgba(255,255,255,.12);border-radius:28px;overflow:hidden;">
            <tr>
              <td style="padding:34px 30px;text-align:center;">
                <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:rgba(103,232,249,.13);color:#67e8f9;font-size:12px;font-weight:800;letter-spacing:.08em;">XAU AI SIGNAL</div>
                <h1 style="margin:22px 0 10px;font-size:36px;line-height:1;color:#ffffff;letter-spacing:-.04em;">${escapeHtml(title)}</h1>
                <p style="margin:0 auto 24px;max-width:430px;color:#b9c7ea;font-size:15px;line-height:1.7;">${escapeHtml(subtitle)}</p>
                <a href="${link}" style="display:inline-block;text-decoration:none;background:linear-gradient(135deg,#ffe879,#19f28f);color:#06111f;font-weight:900;border-radius:999px;padding:14px 22px;">${escapeHtml(buttonText)}</a>
                <p style="margin:22px auto 0;max-width:430px;color:#8fa2c7;font-size:13px;line-height:1.7;">${escapeHtml(note)}</p>
                <div style="margin-top:22px;padding:14px;border-radius:18px;background:rgba(255,255,255,.06);color:#9fb0d6;font-size:12px;line-height:1.6;word-break:break-all;">
                  Kalau tombol tidak bisa dibuka, copy link ini:<br/>
                  <a href="${link}" style="color:#67e8f9;">${link}</a>
                </div>
              </td>
            </tr>
          </table>
          <p style="color:#8fa2c7;font-size:12px;margin:18px 0 0;">Trading XAUUSD berisiko tinggi. Gunakan risk management.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildVerifyEmailHtml({ link }) {
  return buildBaseHtml({
    title: "Verifikasi Email",
    subtitle: "Klik tombol di bawah untuk mengaktifkan email akun XAU AI Signal kamu.",
    buttonText: "Verifikasi Email",
    link,
    note: "Link ini hanya untuk verifikasi email. Abaikan email ini kalau kamu tidak merasa membuat akun."
  });
}

function buildResetPasswordHtml({ link }) {
  return buildBaseHtml({
    title: "Reset Password",
    subtitle: "Klik tombol di bawah untuk membuat password baru akun XAU AI Signal kamu.",
    buttonText: "Buat Password Baru",
    link,
    note: "Link reset password bersifat sensitif. Jangan bagikan link ini ke siapa pun."
  });
}

function cleanFirebaseRestError(msg) {
  if (msg.includes("EMAIL_NOT_FOUND")) return "Email belum terdaftar.";
  if (msg.includes("INVALID_EMAIL")) return "Format email tidak valid.";
  if (msg.includes("USER_DISABLED")) return "Akun dinonaktifkan.";
  if (msg.includes("INVALID_ID_TOKEN")) return "Sesi login tidak valid. Silakan login ulang.";
  return msg;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
