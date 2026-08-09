/**
 * XAU AI Signal - Premium Auto-Downgrade Cron
 *
 * Tujuan:
 * - Cari semua user role "premium" yang premiumUntil-nya sudah LEWAT (expired).
 * - Downgrade otomatis ke role "free" (premiumUntil dikosongkan) supaya akses
 *   premium (sinyal live, AI Analysis, alert Telegram) benar-benar berhenti
 *   begitu masa aktifnya habis, tanpa perlu admin cabut manual satu-satu.
 * - Kirim notif "Premium kamu sudah berakhir" ke email (Resend) dan Telegram
 *   (kalau sudah connect) supaya user tahu kenapa aksesnya berubah jadi free.
 * - Idempotent: user yang sudah role "free" otomatis tidak kena lagi.
 *
 * Dipanggil oleh cPanel Cron via runner PHP:
 *   cron/premium-auto-downgrade-cron-runner.php
 *
 * Auth:
 * - Cron asli   -> header x-premium-downgrade-cron-secret === env.PREMIUM_DOWNGRADE_CRON_SECRET
 * - Admin test  -> Authorization Bearer === env.ADMIN_ACTION_TOKEN, body.preview === true
 *     - kalau body.testUid diisi -> downgrade SUNGGUHAN ke 1 user itu saja (asal memang sudah expired)
 *     - kalau tidak -> dry run, cuma menghitung siapa yang AKAN didowngrade (tidak mengubah apa-apa)
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-premium-downgrade-cron-secret, x-cron-runner"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method tidak didukung." }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const cronSecret = env.PREMIUM_DOWNGRADE_CRON_SECRET || "";
  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const resendKey = env.RESEND_API_KEY || "";
  const emailFrom = env.EMAIL_FROM || "XAU AI Signal <onboarding@resend.dev>";
  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const renewUrl = `${(env.APP_URL || "https://www.xauaisignal.online").replace(/\/$/, "")}/#premium-renew`;

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  // Pakai service account (sama pola dengan admin-user.js / premium-expiry-reminder-cron.js) supaya
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

  const incomingSecret = request.headers.get("x-premium-downgrade-cron-secret")
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
    .filter((user) => isEligibleForDowngrade(user, now));

  const testUid = String(body.testUid || "").trim();
  if (isAdminPreview && testUid) {
    candidates = candidates.length ? candidates.filter((u) => u.uid === testUid) : [];
    if (!candidates.length) {
      const single = usersObj[testUid];
      if (single && isEligibleForDowngrade({ uid: testUid, ...single }, now, true)) {
        candidates = [{ uid: testUid, ...single }];
      }
    }
  }

  // Dry run: preview tanpa testUid -> jangan ubah apa-apa, cuma laporan siapa yang kena.
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
        expiredDaysAgo: expiredDaysAgoOf(u, now)
      }))
    });
  }

  const results = [];

  try {
    for (const user of candidates) {
      const expiredDaysAgo = expiredDaysAgoOf(user, now);
      const entry = { uid: user.uid, email: user.email || null, expiredDaysAgo, email_ok: null, telegram_ok: null };

      const patch = {
        role: "free",
        premiumUntil: null,
        updatedAt: new Date(now).toISOString(),
        premiumAutoDowngradedAt: new Date(now).toISOString(),
        premiumAutoDowngradedFrom: user.premiumUntil
      };

      try {
        await fbPatch(dbUrl, `/users/${user.uid}`, patch, accessToken);
        entry.downgraded = true;
      } catch (e) {
        entry.downgraded = false;
        entry.error = String(e?.message || e);
        results.push(entry);
        continue;
      }

      if (resendKey && user.email) {
        entry.email_ok = await sendDowngradeEmail(resendKey, emailFrom, user, renewUrl);
      }

      if (botToken && user.telegramConnected && user.telegramChatId) {
        const sent = await sendTelegram(botToken, String(user.telegramChatId), buildTelegramText(user), buildRenewKeyboard(renewUrl));
        entry.telegram_ok = sent.ok;
      }

      results.push(entry);
    }

    try {
      await fbPatch(dbUrl, `/xauusd/system/premiumDowngradeCron`, {
        lastRunAt: new Date(now).toISOString(),
        lastStatus: "OK",
        totalDowngraded: results.filter((r) => r.downgraded).length
      }, accessToken);
    } catch (e) {
      // Status log gagal ditulis, tapi downgrade yang sudah dieksekusi tidak dibatalkan.
    }

    if (isCron) {
      try {
        const logId = new Date(now).toISOString().replace(/[.:]/g, "_");
        await fbPut(dbUrl, `/premiumDowngradeLogs/${logId}`, { createdAt: new Date(now).toISOString(), results }, accessToken);
      } catch (e) {
        // Log history gagal ditulis, tidak fatal.
      }
    }

    return json({
      ok: true,
      mode: isAdminPreview ? "test-single-user" : "cron",
      totalDowngraded: results.filter((r) => r.downgraded).length,
      results
    });
  } catch (err) {
    return json({ ok: false, error: `Gagal proses auto-downgrade: ${String(err?.message || err)}`, partialResults: results }, 500);
  }
}

function isEligibleForDowngrade(user, now, isManualTest = false) {
  if (!user) return false;
  if (user.role !== "premium") return false;
  if (!user.premiumUntil) return false;

  const untilMs = new Date(user.premiumUntil).getTime();
  if (!Number.isFinite(untilMs)) return false;

  // Sudah lewat masa aktifnya (expired), bukan cuma "mau habis".
  if (untilMs > now) return false;

  return true;
}

function expiredDaysAgoOf(user, now) {
  const untilMs = new Date(user.premiumUntil).getTime();
  if (!Number.isFinite(untilMs)) return null;
  return Math.max(0, Math.floor((now - untilMs) / (24 * 60 * 60 * 1000)));
}

async function sendDowngradeEmail(resendKey, emailFrom, user, renewUrl) {
  try {
    const html = buildEmailHtml(user, renewUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom,
        to: [user.email],
        subject: "Premium XAU AI Signal kamu sudah berakhir",
        html
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildEmailHtml(user, renewUrl) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
    <h2>XAU AI Signal</h2>
    <p>Halo${user.email ? "" : ""},</p>
    <p>Masa aktif <b>Premium</b> kamu sudah <b>berakhir</b>, jadi akunmu otomatis kembali ke paket <b>Free</b>. Akses sinyal live, AI Analysis, dan alert Telegram premium untuk sementara berhenti.</p>
    <p style="margin-top:16px">Perpanjang sekarang biar bisa lanjut dapat sinyal live, AI Analysis, dan alert Telegram tanpa putus.</p>
    <p style="margin-top:20px">
      <a href="${renewUrl}" style="display:inline-block;background:#facc15;color:#111827;font-weight:900;padding:12px 22px;border-radius:12px;text-decoration:none">
        Perpanjang Sekarang →
      </a>
    </p>
    <p>Thanks,<br/>XAU AI Signal Team</p>
  </div>`;
}

function buildTelegramText(user) {
  return [
    "🔒 <b>Premium Kamu Sudah Berakhir</b>",
    "",
    "Masa aktif Premium XAU AI Signal sudah habis, akunmu otomatis kembali ke paket <b>Free</b>.",
    "Sinyal live, AI Analysis, dan alert Telegram premium untuk sementara berhenti.",
    "",
    "Perpanjang sekarang biar bisa lanjut tanpa putus."
  ].join("\n");
}

function buildRenewKeyboard(renewUrl) {
  return {
    inline_keyboard: [
      [{ text: "💳 Perpanjang Sekarang", url: renewUrl }]
    ]
  };
}

async function sendTelegram(token, chatId, text, replyMarkup = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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
