
const REMIND_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit, cegah spam reminder ke user yang sama

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";

  if (!adminToken || token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  // Sama seperti user-payment-orders.js: pakai service-account access token
  // supaya request server-side ini lolos RTDB rules (yang mewajibkan auth != null
  // dan hanya boleh baca punya sendiri). Tanpa ini, fbGet/fbPatch di bawah akan
  // selalu kena permission-denied dari Firebase -> throw error tak tertangani ->
  // Cloudflare balikin halaman error HTML -> muncul "Unexpected token '<'" di frontend.
  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (err) {
    return json({ ok: false, error: `Gagal ambil service-account token: ${err.message || err}` }, 500);
  }
  if (!accessToken) {
    return json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Cloudflare Pages env." }, 500);
  }

  if (request.method === "GET") {
    const orders = await fbGet(dbUrl, "/paymentOrders", accessToken) || {};
    const adminNotes = await fbGet(dbUrl, "/adminOrderNotes", accessToken) || {};

    const list = Object.values(orders)
      .filter(Boolean)
      .map((order) => {
        const orderId = safeText(order.orderId || "");
        const note = adminNotes?.[orderId] || {};

        return {
          ...order,
          adminNote: note.adminNote || "",
          adminNoteUpdatedAt: note.adminNoteUpdatedAt || ""
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100);

    return json({ ok: true, orders: list });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const action = String(body.action || "").toLowerCase();
  const orderId = String(body.orderId || "").trim();

  if (!orderId) return json({ ok: false, error: "orderId wajib diisi" }, 400);

  const order = await fbGet(dbUrl, `/paymentOrders/${orderId}`, accessToken);
  if (!order) return json({ ok: false, error: "Order tidak ditemukan" }, 404);


  if (action === "savenote" || action === "save_note") {
    const adminNote = safeText(body.adminNote || body.note || "", "").slice(0, 500);
    const now = new Date().toISOString();

    const notePatch = {
      orderId,
      uid: safeText(order.uid || ""),
      email: safeText(order.email || ""),
      adminNote,
      adminNoteUpdatedAt: now,
      updatedAt: now
    };

    await fbPatch(dbUrl, `/adminOrderNotes/${orderId}`, notePatch, accessToken);

    try {
      await fbPatch(dbUrl, `/paymentOrders/${orderId}`, {
        adminNote: null,
        adminNoteUpdatedAt: null,
        updatedAt: now
      }, accessToken);
    } catch {
      // cleanup lama bersifat optional
    }

    return json({
      ok: true,
      order: { ...order, adminNote, adminNoteUpdatedAt: now },
      message: "Catatan order berhasil disimpan"
    });
  }

  if (action === "remind") {
    const status = String(order.status || "pending").toLowerCase();
    if (status !== "pending") {
      return json({ ok: false, error: "Cuma order berstatus pending yang bisa diingatkan." }, 400);
    }

    if (order.remindedAt) {
      const elapsed = Date.now() - new Date(order.remindedAt).getTime();
      if (elapsed < REMIND_COOLDOWN_MS) {
        const waitMin = Math.ceil((REMIND_COOLDOWN_MS - elapsed) / 60000);
        return json({ ok: false, error: `Reminder terakhir baru dikirim. Coba lagi dalam ${waitMin} menit.` }, 429);
      }
    }

    const now = new Date().toISOString();
    const reminderCount = Number(order.reminderCount || 0) + 1;
    const patch = { remindedAt: now, reminderCount, updatedAt: now };

    await fbPatch(dbUrl, `/paymentOrders/${orderId}`, patch, accessToken);
    const user = await fbGet(dbUrl, `/users/${order.uid}`, accessToken) || {};

    const userNotify = await notifyUserPaymentReminder({ env, user, order: { ...order, ...patch } });
    const emailNotify = await sendReminderEmail({ env, user, order: { ...order, ...patch } });

    return json({
      ok: true,
      order: { ...order, ...patch },
      telegramNotify: userNotify,
      emailNotify
    });
  }

  if (action === "reject") {
    const patch = {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fbPatch(dbUrl, `/paymentOrders/${orderId}`, patch, accessToken);
    const user = await fbGet(dbUrl, `/users/${order.uid}`, accessToken) || {};

    await fbPatch(dbUrl, `/users/${order.uid}`, {
      lastPaymentStatus: "rejected",
      lastPaymentOrderId: orderId,
      updatedAt: new Date().toISOString()
    }, accessToken);

    const userNotify = await notifyUserOrderStatus({
      env,
      user,
      order: { ...order, ...patch },
      status: "rejected"
    });

    const emailNotifyReject = await sendOrderStatusEmail({
      env,
      user,
      order: { ...order, ...patch },
      status: "rejected"
    });

    return json({
      ok: true,
      order: { ...order, ...patch },
      telegramNotify: userNotify,
      emailNotify: emailNotifyReject
    });
  }

  if (action !== "approve") {
    return json({ ok: false, error: "action harus approve atau reject" }, 400);
  }

  const days = Number(body.days || getDaysFromPackage(order.packageCode || order.packageLabel));
  if (!days || days <= 0) return json({ ok: false, error: "Durasi paket tidak valid" }, 400);

  const user = await fbGet(dbUrl, `/users/${order.uid}`, accessToken) || {};
  const baseTime = user.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now()
    ? new Date(user.premiumUntil)
    : new Date();

  baseTime.setDate(baseTime.getDate() + days);
  const premiumUntil = baseTime.toISOString();
  const now = new Date().toISOString();

  const orderPatch = {
    status: "approved",
    approvedAt: now,
    approvedDays: days,
    premiumUntil,
    updatedAt: now
  };

  await fbPatch(dbUrl, `/paymentOrders/${orderId}`, orderPatch, accessToken);
  await fbPatch(dbUrl, `/users/${order.uid}`, {
    role: "premium",
    premiumUntil,
    lastPaymentStatus: "approved",
    lastPaymentOrderId: orderId,
    lastPaymentPackage: order.packageLabel || order.packageCode || "",
    lastPaymentPrice: order.price || "",
    updatedAt: now
  }, accessToken);

  const userNotifyApprove = await notifyUserOrderStatus({
    env,
    user,
    order: { ...order, ...orderPatch },
    status: "approved",
    premiumUntil
  });

  const emailNotifyApprove = await sendOrderStatusEmail({
    env,
    user,
    order: { ...order, ...orderPatch },
    status: "approved",
    premiumUntil
  });

  return json({
    ok: true,
    order: { ...order, ...orderPatch },
    premiumUntil,
    telegramNotify: userNotifyApprove,
    emailNotify: emailNotifyApprove
  });
}

function getDaysFromPackage(value) {
  const text = String(value || "");
  // Ambil angka pertama yang muncul di kode/label paket (mis. "Paket 60 Hari", "PKG60D", "30")
  const match = text.match(/\d+/);
  if (!match) return 0;
  const days = parseInt(match[0], 10);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Firebase GET failed ${res.status}`);
  return await res.json();
}

async function fbPatch(dbUrl, path, patch, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase PATCH failed ${res.status}: ${text}`);
  }

  return await res.json();
}


async function notifyUserPaymentReminder({ env, user, order }) {
  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || "";
  const chatId = getUserTelegramChatId(user);

  if (!botToken) {
    return { ok: false, skipped: true, reason: "telegram-bot-token-missing" };
  }
  if (!chatId) {
    return { ok: false, skipped: true, reason: "telegram-not-connected" };
  }

  const lines = [
    "⏰ <b>Reminder Pembayaran</b>",
    "",
    "Order premium kamu masih menunggu pembayaran.",
    `Paket: ${safeText(order.packageLabel || order.packageCode || "-")}`,
    `Harga: ${safeText(order.price || "-")}`,
    `Order ID: <code>${safeText(order.orderId || "-")}</code>`,
    "",
    "Segera selesaikan pembayaran & kirim bukti transfer ke admin supaya premium bisa langsung diaktifkan.",
    "Kalau sudah bayar tapi belum diproses, langsung hubungi admin ya."
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: Boolean(res.ok && data.ok), status: res.status, description: data.description || "" };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function sendReminderEmail({ env, user, order }) {
  const resendKey = env.RESEND_API_KEY || "";
  const from = env.EMAIL_FROM || "";
  const appUrl = env.APP_URL || env.VITE_APP_URL || "https://xau-ai-signal.pages.dev";
  const to = safeText(order.email || user?.email || "");

  if (!resendKey || !from) return { ok: false, skipped: true, reason: "email-env-not-ready" };
  if (!to || to === "-") return { ok: false, skipped: true, reason: "user-email-missing" };

  const body = [
    `<b>Order premium kamu masih menunggu pembayaran.</b>`,
    `Paket: <b>${escapeHtml(safeText(order.packageLabel || order.packageCode || "-"))}</b>`,
    `Harga: <b>${escapeHtml(safeText(order.price || "-"))}</b>`,
    `Order ID: <code>${escapeHtml(safeText(order.orderId || "-"))}</code>`,
    `Segera kirim bukti transfer ke admin supaya premium bisa langsung diaktifkan.`
  ].join("<br/>");

  const html = buildEmailShell({
    title: "Reminder Pembayaran",
    subtitle: "Order premium kamu masih menunggu konfirmasi pembayaran.",
    body,
    buttonText: "Buka Dashboard",
    appUrl
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: "Reminder Pembayaran XAU AI Signal", html })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: "resend-error", error: data?.message || data?.error || `Resend error ${res.status}` };
    return { ok: true, resendId: data?.id || null };
  } catch (err) {
    return { ok: false, reason: "email-send-error", error: err.message || String(err) };
  }
}


async function notifyUserOrderStatus({ env, user, order, status, premiumUntil }) {
  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || "";
  const chatId = getUserTelegramChatId(user);

  if (!botToken) {
    return { ok: false, skipped: true, reason: "telegram-bot-token-missing" };
  }

  if (!chatId) {
    return {
      ok: false,
      skipped: true,
      reason: "telegram-not-connected",
      checkedFields: [
        "telegramChatId",
        "telegram_chat_id",
        "telegram.chatId",
        "telegram.chat_id",
        "telegram.id",
        "telegramId",
        "chatId",
        "chat_id"
      ]
    };
  }

  const isApproved = status === "approved";
  const title = isApproved ? "✅ Premium Aktif" : "❌ Pembayaran Ditolak";

  const lines = isApproved ? [
    title,
    "",
    `Paket: ${safeText(order.packageLabel || order.packageCode || "-")}`,
    `Order ID: ${safeText(order.orderId || "-")}`,
    `Premium aktif sampai: ${formatTelegramDate(premiumUntil)}`,
    "",
    "Silakan buka dashboard XAU AI Signal untuk mulai menggunakan fitur premium."
  ] : [
    title,
    "",
    `Paket: ${safeText(order.packageLabel || order.packageCode || "-")}`,
    `Order ID: ${safeText(order.orderId || "-")}`,
    "",
    "Pembayaran belum bisa dikonfirmasi. Silakan hubungi admin dan kirim ulang bukti pembayaran jika diperlukan."
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\\n"),
        disable_web_page_preview: true
      })
    });

    const data = await res.json().catch(() => ({}));

    return {
      ok: Boolean(res.ok && data.ok),
      status: res.status,
      description: data.description || ""
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}


function getUserTelegramChatId(user = {}) {
  const candidates = [
    user.telegramChatId,
    user.telegram_chat_id,
    user.telegramId,
    user.telegram_id,
    user.chatId,
    user.chat_id,
    user?.telegram?.chatId,
    user?.telegram?.chat_id,
    user?.telegram?.id,
    user?.telegram?.chatID,
    user?.telegramConnect?.chatId,
    user?.telegramConnect?.chat_id
  ];

  for (const value of candidates) {
    const text = safeText(value, "");
    if (text && text !== "-") return text;
  }

  return "";
}


function safeText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function formatTelegramDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}



async function sendOrderStatusEmail({ env, user, order, status, premiumUntil }) {
  const resendKey = env.RESEND_API_KEY || "";
  const from = env.EMAIL_FROM || "";
  const appUrl = env.APP_URL || env.VITE_APP_URL || "https://xau-ai-signal.pages.dev";
  const to = safeText(order.email || user?.email || "");

  if (!resendKey || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "email-env-not-ready"
    };
  }

  if (!to || to === "-") {
    return {
      ok: false,
      skipped: true,
      reason: "user-email-missing"
    };
  }

  const isApproved = status === "approved";
  const subject = isApproved
    ? "Premium XAU AI Signal Kamu Sudah Aktif"
    : "Konfirmasi Pembayaran XAU AI Signal";

  const html = isApproved
    ? buildApprovedEmailHtml({ order, premiumUntil, appUrl })
    : buildRejectedEmailHtml({ order, appUrl });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        skipped: false,
        reason: "resend-error",
        error: data?.message || data?.error || `Resend error ${res.status}`
      };
    }

    return {
      ok: true,
      skipped: false,
      resendId: data?.id || null
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: "email-send-error",
      error: err.message || String(err)
    };
  }
}

function buildEmailShell({ title, subtitle, body, buttonText, appUrl }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#060814;font-family:Arial,Helvetica,sans-serif;color:#f8fbff;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(135deg,#120a2c,#022d36);padding:34px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;background:rgba(10,16,31,.96);border:1px solid rgba(255,255,255,.12);border-radius:26px;overflow:hidden;">
            <tr>
              <td style="padding:34px 30px;text-align:center;">
                <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:rgba(103,232,249,.13);color:#67e8f9;font-size:12px;font-weight:800;letter-spacing:.08em;">XAU AI SIGNAL</div>
                <h1 style="margin:22px 0 10px;font-size:34px;line-height:1;color:#ffffff;letter-spacing:-.04em;">${escapeHtml(title)}</h1>
                <p style="margin:0 auto 22px;max-width:440px;color:#b9c7ea;font-size:15px;line-height:1.7;">${escapeHtml(subtitle)}</p>
                <div style="margin:20px auto;padding:18px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);text-align:left;color:#dce6ff;font-size:14px;line-height:1.8;">
                  ${body}
                </div>
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;text-decoration:none;background:linear-gradient(135deg,#ffe879,#19f28f);color:#06111f;font-weight:900;border-radius:999px;padding:14px 22px;">${escapeHtml(buttonText)}</a>
                <p style="margin:20px auto 0;max-width:440px;color:#8fa2c7;font-size:12px;line-height:1.7;">Trading XAUUSD berisiko tinggi. Gunakan risk management.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildApprovedEmailHtml({ order, premiumUntil, appUrl }) {
  const body = [
    `<b>Premium kamu sudah aktif.</b>`,
    `Paket: <b>${escapeHtml(safeText(order.packageLabel || order.packageCode || "-"))}</b>`,
    `Harga: <b>${escapeHtml(safeText(order.price || "-"))}</b>`,
    `Order ID: <code>${escapeHtml(safeText(order.orderId || "-"))}</code>`,
    `Premium aktif sampai: <b>${escapeHtml(formatTelegramDate(premiumUntil))}</b>`
  ].join("<br/>");

  return buildEmailShell({
    title: "Premium Aktif",
    subtitle: "Pembayaran kamu sudah dikonfirmasi oleh admin.",
    body,
    buttonText: "Buka Dashboard",
    appUrl
  });
}

function buildRejectedEmailHtml({ order, appUrl }) {
  const body = [
    `<b>Pembayaran kamu belum bisa dikonfirmasi.</b>`,
    `Paket: <b>${escapeHtml(safeText(order.packageLabel || order.packageCode || "-"))}</b>`,
    `Harga: <b>${escapeHtml(safeText(order.price || "-"))}</b>`,
    `Order ID: <code>${escapeHtml(safeText(order.orderId || "-"))}</code>`,
    `Silakan hubungi admin dan kirim ulang bukti pembayaran jika diperlukan.`
  ].join("<br/>");

  return buildEmailShell({
    title: "Pembayaran Belum Dikonfirmasi",
    subtitle: "Admin belum bisa memverifikasi pembayaran untuk order ini.",
    body,
    buttonText: "Buka Dashboard",
    appUrl
  });
}

function escapeHtml(value) {
  return safeText(value)
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

// ---- Firebase service-account OAuth (sama pola dengan user-payment-orders.js) ----
// Ini yang bikin request server-side ini "jadi admin" di mata RTDB rules,
// karena akun servis punya akses penuh dan tidak terikat rule ".read"/".write" biasa.
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
  const projectId = env.FIREBASE_PROJECT_ID || env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "";
  const clientEmail = env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_ADMIN_CLIENT_EMAIL || "";
  const privateKey = env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY || env.FIREBASE_ADMIN_PRIVATE_KEY || "";
  if (!projectId || !clientEmail || !privateKey) return null;
  return normalizeServiceAccount({ projectId, clientEmail, privateKey });
}
function normalizeServiceAccount({ projectId, clientEmail, privateKey }) {
  const cleanProjectId = String(projectId || "").trim();
  const cleanClientEmail = String(clientEmail || "").trim();
  const cleanPrivateKey = String(privateKey || "").replace(/\\n/g, "\n").trim();
  if (!cleanProjectId || !cleanClientEmail || !cleanPrivateKey) return null;
  return { projectId: cleanProjectId, clientEmail: cleanClientEmail, privateKey: cleanPrivateKey };
}
async function getGoogleAccessToken(service) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: service.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
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
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "Gagal mengambil Firebase service-account access token.");
  }
  return data.access_token;
}
async function signRs256(input, privateKeyPem) {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return arrayBufferToBase64Url(signature);
}
function pemToArrayBuffer(pem) {
  const clean = String(pem || "").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function base64UrlJson(value) {
  return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer);
}
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
