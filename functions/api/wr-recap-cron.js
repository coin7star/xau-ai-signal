import { statsFromList, periodWindowWIB, filterHistoryByWindow } from "./pip-utils.js";

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-wr-recap-cron-secret, x-cron-runner"
};

const PERIOD_LABEL = { daily: "HARIAN", weekly: "MINGGUAN", monthly: "BULANAN" };

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method tidak didukung. Endpoint cron hanya menerima POST." }, 405);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  const cronSecret = env.WR_RECAP_CRON_SECRET || "";
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  const incomingToken = request.headers.get("x-wr-recap-cron-secret")
    || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
    || body.token || "";

  const isCron = Boolean(cronSecret) && incomingToken === cronSecret;
  const isAdminPreview = Boolean(adminToken) && incomingToken === adminToken && body.preview === true;

  if (!isCron && !isAdminPreview) {
    return json({ ok: false, error: "Token tidak valid. Pakai cron secret, atau admin token + preview:true." }, 401);
  }

  const period = ["daily", "weekly", "monthly"].includes(String(body.period || "").toLowerCase())
    ? String(body.period).toLowerCase() : "daily";

  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (e) {
    return json({ ok: false, error: `Gagal ambil Firebase service-account token: ${e?.message || e}` }, 500);
  }

  try {
    const rawHistory = await fbGet(dbUrl, "/manualSignals/history", accessToken);
    const { from, to } = isAdminPreview ? previewWindowWIB(period) : periodWindowWIB(period);
    const windowed = filterHistoryByWindow(rawHistory, from, to);
    const stats = statsFromList(windowed);

    const rangeLabel = formatRangeWIB(from, to, period) + (isAdminPreview ? " (preview, s/d sekarang)" : "");

    if (!isAdminPreview) {
      const logId = `${period}-${new Date(to).toISOString().slice(0, 10)}`;
      await fbPut(dbUrl, `/wrRecaps/${period}/${safeKey(logId)}`, { ...stats, period, from, to, sentAt: new Date().toISOString() }, accessToken);
    }

    const notifications = await notifyRecapTelegram(env, dbUrl, period, rangeLabel, stats, accessToken, isAdminPreview);
    return json({ ok: true, period, rangeLabel, stats, notifications, preview: isAdminPreview });
  } catch (e) {
    console.error("wr-recap-cron error", e);
    return json({ ok: false, error: e?.message || "Terjadi kesalahan tak terduga." }, 500);
  }
}

// Window "hari ini s/d sekarang" (WIB) - khusus admin preview, supaya bisa test
// langsung tanpa harus nunggu window resmi "kemarin penuh" milik cron asli.
function previewWindowWIB(period, refDate = new Date()) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wib = new Date(refDate.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth(), d = wib.getUTCDate();
  const todayMidnightWIB = Date.UTC(y, m, d, 0, 0, 0) - WIB_OFFSET_MS;
  const now = refDate.getTime();

  if (period === "weekly") {
    const from = todayMidnightWIB - 7 * 24 * 60 * 60 * 1000;
    return { from, to: now };
  }
  if (period === "monthly") {
    const firstOfThisMonthWIB = Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS;
    return { from: firstOfThisMonthWIB, to: now };
  }
  return { from: todayMidnightWIB, to: now };
}

function formatRangeWIB(from, to, period) {
  const opts = { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" };
  const fromLabel = new Date(from).toLocaleDateString("id-ID", opts);
  const toLabel = new Date(to - 1).toLocaleDateString("id-ID", opts);
  if (period === "daily") return fromLabel;
  return `${fromLabel} — ${toLabel}`;
}

async function notifyRecapTelegram(env, dbUrl, period, rangeLabel, stats, accessToken, isPreview) {
  const token = env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return { ok: false, skipped: true, reason: "TELEGRAM_BOT_TOKEN missing", totalRecipients: 0, successCount: 0, failedCount: 0 };
  const raw = await fbGet(dbUrl, "/users", accessToken);
  const users = Object.values(raw || {}).filter(isPremiumConnected);
  const seen = new Set();
  const recipients = users.filter((u) => { const id = String(u.telegramChatId); if (!id || seen.has(id)) return false; seen.add(id); return true; });

  const pipSign = stats.totalPip >= 0 ? "+" : "";
  const text = [
    isPreview ? `🧪 <b>[PREVIEW TEST] REKAP ${PERIOD_LABEL[period]}</b>` : `📊 <b>REKAP ${PERIOD_LABEL[period]} — XAU AI SIGNAL</b>`, "",
    `Periode: <b>${escapeHtml(rangeLabel)}</b> (WIB)`, "",
    `Winrate: <b>${stats.winratePercent}%</b> (${stats.wins}W/${stats.losses}L/${stats.be}BE dari ${stats.total} call)`,
    `Total Pip: <b>${pipSign}${stats.totalPip} pip</b>`, "",
    stats.total === 0 ? "Tidak ada call yang selesai di periode ini." : "",
    isPreview ? "🧪 Ini pesan preview/test dari admin, bukan recap resmi." : "👑 Premium Alert • XAU AI Signal"
  ].filter(Boolean).join("\n");

  let successCount = 0, failedCount = 0;
  for (const u of recipients) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(u.telegramChatId), text, parse_mode: "HTML", disable_web_page_preview: true })
      });
      if (res.ok) successCount++; else failedCount++;
    } catch { failedCount++; }
  }
  return { ok: failedCount === 0, totalRecipients: recipients.length, successCount, failedCount };
}

function isPremiumConnected(u) {
  if (!u?.telegramConnected || !u?.telegramChatId) return false;
  if (u.status && u.status !== "active") return false;
  if (u.role === "admin") return true;
  if (u.role !== "premium") return false;
  const until = u.premiumUntil || u.expiredAt;
  return Boolean(until) && new Date(until).getTime() > Date.now();
}
function safeKey(v) { return String(v).replace(/[.#$[\]/:]/g, "_"); }
function escapeHtml(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const r = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!r.ok) { const body = await r.text().catch(() => ""); throw new Error(`Firebase GET ${path} gagal (${r.status}): ${body.slice(0, 180)}`); }
  return await r.json();
}
async function fbPut(dbUrl, path, data, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const r = await fetch(url.toString(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) { const body = await r.text().catch(() => ""); throw new Error(`Firebase PUT ${path} gagal (${r.status}): ${body.slice(0, 180)}`); }
  return await r.json();
}
function json(payload, status = 200) { return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } }); }

function readServiceAccount(env) {
  const jsonRaw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_ADMIN_SERVICE_ACCOUNT || "";
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      return normalizeServiceAccount({ projectId: parsed.project_id || parsed.projectId, clientEmail: parsed.client_email || parsed.clientEmail, privateKey: parsed.private_key || parsed.privateKey });
    } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak valid."); }
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
  const payload = { iss: service.clientEmail, scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = await signRs256(unsigned, service.privateKey);
  const assertion = `${unsigned}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
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
function base64UrlJson(value) { return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer); }
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
