/**
 * XAU AI Signal - Premium Expiry Reminder Cron (H-1)
 *
 * Tujuan:
 * - Cari semua user premium (bukan admin) yang masa aktifnya tinggal <= 1 hari.
 * - Kirim reminder ke email (via Resend) dan ke Telegram (kalau sudah connect).
 * - Dedupe: satu user cuma dikirimi SATU KALI per tanggal expiry (premiumUntil) yang sama,
 *   jadi walau cron jalan beberapa kali sehari, tidak spam.
 *
 * Dipanggil oleh cPanel Cron via runner PHP:
 *   cron/premium-expiry-reminder-cron-runner.php
 *
 * Auth:
 * - Cron asli   -> header x-premium-reminder-cron-secret === env.PREMIUM_REMINDER_CRON_SECRET
 * - Admin test  -> Authorization Bearer === env.ADMIN_ACTION_TOKEN, body.preview === true
 *     - kalau body.testUid diisi -> kirim SUNGGUHAN ke 1 user itu saja (tidak menandai dedupe)
 *     - kalau tidak -> dry run, cuma menghitung siapa yang AKAN menerima (tidak mengirim apa-apa)
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-premium-reminder-cron-secret, x-cron-runner"
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method tidak didukung." }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const cronSecret = env.PREMIUM_REMINDER_CRON_SECRET || "";
  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const resendKey = env.RESEND_API_KEY || "";
  const emailFrom = env.EMAIL_FROM || "XAU AI Signal <onboarding@resend.dev>";
  const botToken = env.TELEGRAM_BOT_TOKEN || "";

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  // Pakai service account (sama pola dengan admin-user.js / wr-recap-cron.js) supaya
  // request ke Firebase RTDB dianggap "admin" dan tidak diblokir oleh security rules
  // (rules cuma izinkan user baca/tulis /users/{uid} miliknya sendiri).
  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (e) {
    return json({ ok: false, error: `Gagal ambil Firebase service-account token: ${e?.message || e}` }, 500);
  }

  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  const incomingSecret = request.headers.get("x-premium-reminder-cron-secret")
    || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
    || body.token || "";

  const isCron = Boolean(cronSecret) && incomingSecret === cronSecret;
  const isAdminPreview = Boolean(adminToken) && incomingSecret === adminToken && body.preview === true;

  if (!isCron && !isAdminPreview) {
    return json({ ok: false, error: "Token tidak valid. Pakai cron secret, atau admin token + preview:true." }, 401);
  }

  let usersRaw;
  try {
    usersRaw = await fbGet(dbUrl, "/users", accessToken);
  } catch (err) {
    return json({ ok: false, error: `Gagal ambil data users dari Firebase: ${String(err?.message || err)}` }, 500);
  }
  const usersObj = usersRaw || {};
  const now = Date.now();

  let candidates = Object.entries(usersObj)
    .map(([uid, user]) => ({ uid, ...user }))
    .filter((user) => isEligibleForReminder(user, now));

  const testUid = String(body.testUid || "").trim();
  if (isAdminPreview && testUid) {
    candidates = candidates.length ? candidates.filter((u) => u.uid === testUid) : [];
    if (!candidates.length) {
      const single = usersObj[testUid];
      if (single) candidates = [{ uid: testUid, ...single }];
    }
  }

  // Dry run: preview tanpa testUid -> jangan kirim apa-apa, cuma laporan siapa yang kena.
  if (isAdminPreview && !testUid) {
    return json({
      ok: true,
      mode: "dry-run",
      totalCandidates: candidates.length,
      candidates: candidates.map((u) => ({
        uid: u.uid,
        email: u.email || null,
        telegramConnected: Boolean(u.telegramConnected && u.telegramChatId),
        premiumUntil: u.premiumUntil,
        daysLeft: daysLeftOf(u, now)
      }))
    });
  }

  if (!resendKey && !botToken) {
    return json({ ok: false, error: "RESEND_API_KEY dan TELEGRAM_BOT_TOKEN belum diset, tidak ada cara kirim reminder." }, 500);
  }

  const results = [];

  try {
    for (const user of candidates) {
      const daysLeft = daysLeftOf(user, now);
      const entry = { uid: user.uid, email: user.email || null, daysLeft, email_ok: null, telegram_ok: null };

      if (resendKey && user.email) {
        entry.email_ok = await sendReminderEmail(resendKey, emailFrom, user, daysLeft);
      }

      if (botToken && user.telegramConnected && user.telegramChatId) {
        const sent = await sendTelegram(botToken, String(user.telegramChatId), buildTelegramText(user, daysLeft));
        entry.telegram_ok = sent.ok;
      }

      results.push(entry);

      // Dedupe cuma ditandai untuk pengiriman resmi (cron asli, bukan test 1 user).
      if (isCron) {
        try {
          await fbPatch(dbUrl, `/users/${user.uid}`, {
            premiumReminder1DaySentAt: new Date(now).toISOString(),
            premiumReminder1DaySentFor: user.premiumUntil
          }, accessToken);
        } catch (e) {
          entry.dedupe_write_error = String(e?.message || e);
        }
      }
    }

    try {
      await fbPatch(dbUrl, `/xauusd/system/premiumReminderCron`, {
        lastRunAt: new Date(now).toISOString(),
        lastStatus: "OK",
        totalSent: results.length
      }, accessToken);
    } catch (e) {
      // Status log gagal ditulis, tapi reminder yang sudah terkirim tidak dibatalkan.
    }

    if (isCron) {
      try {
        const logId = new Date(now).toISOString().replace(/[.:]/g, "_");
        await fbPut(dbUrl, `/premiumReminderLogs/${logId}`, { createdAt: new Date(now).toISOString(), results }, accessToken);
      } catch (e) {
        // Log history gagal ditulis, tidak fatal.
      }
    }

    return json({
      ok: true,
      mode: isAdminPreview ? "test-single-user" : "cron",
      totalSent: results.length,
      results
    });
  } catch (err) {
    return json({ ok: false, error: `Gagal proses reminder: ${String(err?.message || err)}`, partialResults: results }, 500);
  }
}

function isEligibleForReminder(user, now) {
  if (!user) return false;
  if (user.role !== "premium") return false;
  if (user.status && user.status !== "active") return false;
  if (!user.premiumUntil) return false;

  const untilMs = new Date(user.premiumUntil).getTime();
  if (!Number.isFinite(untilMs)) return false;

  const expiresWithin1Day = untilMs > now && untilMs <= now + ONE_DAY_MS;
  if (!expiresWithin1Day) return false;

  // Sudah pernah diingatkan untuk tanggal expiry yang sama? skip.
  if (user.premiumReminder1DaySentFor && user.premiumReminder1DaySentFor === user.premiumUntil) return false;

  return true;
}

function daysLeftOf(user, now) {
  const untilMs = new Date(user.premiumUntil).getTime();
  if (!Number.isFinite(untilMs)) return null;
  return Math.max(0, Math.ceil((untilMs - now) / ONE_DAY_MS));
}

async function sendReminderEmail(resendKey, emailFrom, user, daysLeft) {
  try {
    const untilLabel = formatDateID(user.premiumUntil);
    const html = buildEmailHtml(user, daysLeft, untilLabel);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom,
        to: [user.email],
        subject: `⏳ Premium XAU AI Signal kamu berakhir ${daysLeft <= 1 ? "besok" : `${daysLeft} hari lagi`}`,
        html
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildEmailHtml(user, daysLeft, untilLabel) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
    <h2>XAU AI Signal</h2>
    <p>Halo${user.email ? "" : ""},</p>
    <p>Masa aktif <b>Premium</b> kamu akan berakhir <b>${daysLeft <= 1 ? "besok" : `dalam ${daysLeft} hari`}</b>, tepatnya:</p>
    <div style="font-size:20px;font-weight:900;background:#111827;color:#facc15;padding:14px 18px;border-radius:14px;width:max-content">
      ${untilLabel}
    </div>
    <p style="margin-top:16px">Perpanjang sekarang biar tetap dapat sinyal live, AI Analysis, dan alert Telegram tanpa putus.</p>
    <p>Thanks,<br/>XAU AI Signal Team</p>
  </div>`;
}

function buildTelegramText(user, daysLeft) {
  const untilLabel = formatDateID(user.premiumUntil);
  return [
    "⏳ <b>Premium Kamu Mau Habis</b>",
    "",
    `Masa aktif Premium XAU AI Signal ${daysLeft <= 1 ? "berakhir <b>besok</b>" : `berakhir dalam <b>${daysLeft} hari</b>`}.`,
    `Tanggal: <b>${untilLabel}</b>`,
    "",
    "Perpanjang sekarang biar tetap dapat sinyal live & alert Telegram tanpa putus."
  ].join("\n");
}

function formatDateID(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" });
  } catch {
    return String(iso || "");
  }
}

async function sendTelegram(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firebase GET ${path} gagal (${res.status}): ${body.slice(0, 180)}`);
  }
  return await res.json();
}

async function fbPut(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function fbPatch(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } });
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
  if (!res.ok || !data.access_token) throw new Error(data?.error_description || data?.error || "Gagal mengambil Firebase service-account access token.");
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
