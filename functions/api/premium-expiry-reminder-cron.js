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

  const usersRaw = await fbGet(dbUrl, "/users");
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
      await fbPatch(dbUrl, `/users/${user.uid}`, {
        premiumReminder1DaySentAt: new Date(now).toISOString(),
        premiumReminder1DaySentFor: user.premiumUntil
      });
    }
  }

  const logId = new Date(now).toISOString().replace(/[.:]/g, "_");
  await fbPut(dbUrl, `/xauusd/system/premiumReminderCron`, {
    lastRunAt: new Date(now).toISOString(),
    lastStatus: "OK",
    totalSent: results.length
  });
  if (isCron) {
    await fbPut(dbUrl, `/premiumReminderLogs/${logId}`, { createdAt: new Date(now).toISOString(), results });
  }

  return json({
    ok: true,
    mode: isAdminPreview ? "test-single-user" : "cron",
    totalSent: results.length,
    results
  });
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

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
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

async function fbPatch(dbUrl, path, data) {
  const res = await fetch(`${dbUrl}${path}.json`, {
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
