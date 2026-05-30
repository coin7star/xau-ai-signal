const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
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

  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) return json({ ok: false, error: "Email tidak valid." }, 400);

  const resendKey = env.RESEND_API_KEY || "";
  const from = env.EMAIL_FROM || "XAU AI Signal <noreply@xauaisignal.online>";
  const appUrl = getAppUrl(env);

  if (!resendKey) return json({ ok: false, error: "RESEND_API_KEY belum diset di Cloudflare." }, 500);

  try {
    const firebaseLink = await createFirebaseEmailVerificationLink({ env, email, appUrl });
    const verifyLink = buildDirectVerifyLink({ firebaseLink, appUrl, env });

    const sent = await sendResendEmail({
      resendKey,
      from,
      to: email,
      subject: "Verifikasi email XAU AI Signal",
      html: buildVerifyEmailHtml({ email, verifyLink, appUrl }),
      text: `Verifikasi email XAU AI Signal\n\nBuka link ini untuk memverifikasi email Anda:\n${verifyLink}\n\nJika Anda tidak membuat akun XAU AI Signal, abaikan email ini.`
    });

    if (!sent.ok) {
      return json({ ok: false, error: sent.error || "Gagal mengirim email verifikasi." }, 502);
    }

    return json({ ok: true, message: "Email verifikasi berhasil dikirim." });
  } catch (error) {
    console.error("custom verify email error", error);
    return json({ ok: false, error: safePublicError(error) }, 500);
  }
}

async function createFirebaseEmailVerificationLink({ env, email, appUrl }) {
  const service = readServiceAccount(env);
  const token = await getGoogleAccessToken(service);

  const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(service.projectId)}/accounts:sendOobCode`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requestType: "VERIFY_EMAIL",
      email,
      returnOobLink: true,
      continueUrl: `${appUrl}/auth-action`
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const firebaseMessage = data?.error?.message || data?.message || `Firebase error ${res.status}`;
    throw new Error(firebaseMessage);
  }

  const link = data.oobLink || data.emailLink || data.oobLinkUrl || "";
  if (!link) throw new Error("Firebase tidak mengembalikan verification link.");

  return link;
}

function buildDirectVerifyLink({ firebaseLink, appUrl, env }) {
  try {
    const source = new URL(firebaseLink);
    const target = new URL(`${appUrl}/auth-action`);

    const oobCode = source.searchParams.get("oobCode") || "";
    const apiKey = source.searchParams.get("apiKey") || env.VITE_FIREBASE_API_KEY || "";
    const lang = source.searchParams.get("lang") || "id";

    target.searchParams.set("mode", "verifyEmail");
    if (oobCode) target.searchParams.set("oobCode", oobCode);
    if (apiKey) target.searchParams.set("apiKey", apiKey);
    target.searchParams.set("lang", lang);
    target.searchParams.set("continueUrl", appUrl);

    return target.toString();
  } catch {
    return firebaseLink;
  }
}

async function sendResendEmail({ resendKey, from, to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, html, text })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, error: data?.message || data?.error || `Resend error ${res.status}` };
  }

  return { ok: true, id: data?.id || null };
}

async function getGoogleAccessToken(service) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: service.clientEmail,
    scope: "https://www.googleapis.com/auth/identitytoolkit",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = await signRs256(unsigned, service.privateKey);
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "Gagal mengambil Google access token.");
  }

  return data.access_token;
}

async function signRs256(input, privateKeyPem) {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );

  return arrayBufferToBase64Url(signature);
}

function readServiceAccount(env) {
  const jsonRaw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_ADMIN_SERVICE_ACCOUNT || "";

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      return normalizeServiceAccount({
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: parsed.private_key || parsed.privateKey
      });
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak valid.");
    }
  }

  return normalizeServiceAccount({
    projectId: env.FIREBASE_PROJECT_ID || env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY || env.FIREBASE_ADMIN_PRIVATE_KEY
  });
}

function normalizeServiceAccount({ projectId, clientEmail, privateKey }) {
  const cleanProjectId = String(projectId || "").trim();
  const cleanClientEmail = String(clientEmail || "").trim();
  const cleanPrivateKey = String(privateKey || "").replace(/\\n/g, "\n").trim();

  if (!cleanProjectId) throw new Error("FIREBASE_PROJECT_ID belum diset.");
  if (!cleanClientEmail) throw new Error("FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL belum diset.");
  if (!cleanPrivateKey) throw new Error("FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY belum diset.");

  return {
    projectId: cleanProjectId,
    clientEmail: cleanClientEmail,
    privateKey: cleanPrivateKey
  };
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function base64UrlJson(value) {
  return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer);
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildResetPasswordEmailHtml({ email, resetLink, appUrl }) {
  const safeEmail = escapeHtml(email);
  const safeResetLink = escapeHtml(resetLink);
  const safeAppUrl = escapeHtml(appUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Reset sandi XAU AI Signal</title>
  </head>
  <body style="margin:0;background:#060814;font-family:Arial,Helvetica,sans-serif;color:#f8fbff;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(135deg,#120a2c,#022d36);padding:34px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;background:#0a1020;border:1px solid rgba(255,255,255,.12);border-radius:26px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;background:linear-gradient(135deg,rgba(103,232,249,.18),rgba(167,139,250,.20));">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(45,212,191,.14);color:#99f6e4;font-weight:800;font-size:12px;letter-spacing:.06em;">XAU AI SIGNAL</div>
                <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.1;color:#ffffff;">Reset sandi akun Anda</h1>
                <p style="margin:0;color:#b8c4e8;font-size:15px;line-height:1.55;">Kami menerima permintaan untuk membuat sandi baru akun ${safeEmail}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <p style="margin:0 0 18px;color:#dbe7ff;font-size:15px;line-height:1.6;">Klik tombol di bawah untuk membuka halaman resmi XAU AI Signal dan membuat sandi baru.</p>
                <a href="${safeResetLink}" style="display:inline-block;background:linear-gradient(135deg,#67e8f9,#c4b5fd);color:#05111f;text-decoration:none;font-weight:900;padding:14px 20px;border-radius:14px;">Reset Sandi Sekarang</a>
                <p style="margin:22px 0 0;color:#93a3c9;font-size:13px;line-height:1.6;">Jika tombol tidak bisa diklik, salin link ini ke browser:</p>
                <p style="word-break:break-all;margin:8px 0 0;color:#67e8f9;font-size:12px;line-height:1.6;">${safeResetLink}</p>
                <hr style="border:0;border-top:1px solid rgba(255,255,255,.10);margin:24px 0;" />
                <p style="margin:0;color:#93a3c9;font-size:13px;line-height:1.6;">Jika Anda tidak meminta reset sandi, abaikan email ini. Domain resmi: ${safeAppUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getAppUrl(env) {
  return String(env.APP_URL || env.VITE_APP_URL || env.DASHBOARD_URL || "https://www.xauaisignal.online").replace(/\/$/, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safePublicError(error) {
  const msg = String(error?.message || error || "");
  if (msg.includes("EMAIL_NOT_FOUND")) return "Email belum terdaftar.";
  if (msg.includes("FIREBASE")) return msg;
  if (msg.includes("RESEND")) return msg;
  if (msg.includes("Google access token")) return msg;
  if (msg.includes("Firebase")) return msg;
  return msg || "Gagal mengirim email reset custom.";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: H });
}

function buildVerifyEmailHtml({ email, verifyLink, appUrl }) {
  const safeEmail = escapeHtml(email);
  const safeVerifyLink = escapeHtml(verifyLink);
  const safeAppUrl = escapeHtml(appUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Verifikasi email XAU AI Signal</title>
  </head>
  <body style="margin:0;background:#060814;font-family:Arial,Helvetica,sans-serif;color:#f8fbff;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(135deg,#120a2c,#022d36);padding:34px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;background:#0a1020;border:1px solid rgba(255,255,255,.12);border-radius:26px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;background:linear-gradient(135deg,rgba(103,232,249,.18),rgba(167,139,250,.20));">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(45,212,191,.14);color:#99f6e4;font-weight:800;font-size:12px;letter-spacing:.06em;">XAU AI SIGNAL</div>
                <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.1;color:#ffffff;">Verifikasi email Anda</h1>
                <p style="margin:0;color:#b8c4e8;font-size:15px;line-height:1.55;">Klik tombol di bawah untuk mengaktifkan akun ${safeEmail}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <p style="margin:0 0 18px;color:#dbe7ff;font-size:15px;line-height:1.6;">Verifikasi ini memastikan akun Anda aman dan email benar-benar milik Anda.</p>
                <a href="${safeVerifyLink}" style="display:inline-block;background:linear-gradient(135deg,#67e8f9,#c4b5fd);color:#05111f;text-decoration:none;font-weight:900;padding:14px 20px;border-radius:14px;">Verifikasi Email Sekarang</a>
                <p style="margin:22px 0 0;color:#93a3c9;font-size:13px;line-height:1.6;">Jika tombol tidak bisa diklik, salin link ini ke browser:</p>
                <p style="word-break:break-all;margin:8px 0 0;color:#67e8f9;font-size:12px;line-height:1.6;">${safeVerifyLink}</p>
                <hr style="border:0;border-top:1px solid rgba(255,255,255,.10);margin:24px 0;" />
                <p style="margin:0;color:#93a3c9;font-size:13px;line-height:1.6;">Jika Anda tidak membuat akun, abaikan email ini. Domain resmi: ${safeAppUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
