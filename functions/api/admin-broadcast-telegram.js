const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  const botToken = env.TELEGRAM_BOT_TOKEN || "";

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);
  if (!botToken) return json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diset" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Unauthorized admin token" }, 401);
  }

  const text = String(body.text || "").trim();
  const target = String(body.target || "premium_connected").trim();

  if (!text || text.length < 3) {
    return json({ ok: false, error: "Isi broadcast minimal 3 karakter" }, 400);
  }

  // Sama seperti admin-orders.js / admin-status.js: pakai service-account access token
  // supaya request server-side ini lolos RTDB rules (yang mewajibkan auth != null).
  // Tanpa ini, fbGet/fbPut di bawah selalu kena permission-denied dari Firebase.
  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (err) {
    return json({ ok: false, error: `Gagal ambil service-account token: ${err?.message || err}` }, 500);
  }
  if (!accessToken) {
    return json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Cloudflare Pages env." }, 500);
  }

  try {
    const usersRaw = await fbGet(dbUrl, "/users", accessToken);
    const users = Object.values(usersRaw || {}).filter(Boolean);

    let recipients = users.filter((user) => {
      if (!user.telegramConnected || !user.telegramChatId) return false;

      if (target === "all_connected") return true;
      if (target === "admin_connected") return user.role === "admin";
      return isPremium(user);
    });

    const seen = new Set();
    recipients = recipients.filter((user) => {
      const chatId = String(user.telegramChatId || "");
      if (!chatId || seen.has(chatId)) return false;
      seen.add(chatId);
      return true;
    });

    const finalText = [
      "📣 <b>XAU AI Signal Broadcast</b>",
      "",
      escapeHtml(text),
      "",
      "<i>Official update dari XAU AI Signal.</i>"
    ].join("\n");

    const results = [];

    for (const user of recipients) {
      const sent = await sendTelegram(botToken, String(user.telegramChatId), finalText);
      results.push({
        uid: user.uid || null,
        email: user.email || null,
        chatId: maskChatId(user.telegramChatId),
        ok: sent.ok,
        status: sent.status
      });
    }

    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - successCount;
    const logId = safeKey(new Date().toISOString());

    try {
      await fbPut(dbUrl, `/xauusd/telegram/broadcastLogs/${logId}`, {
        text,
        target,
        totalRecipients: results.length,
        successCount,
        failedCount,
        results,
        createdAt: new Date().toISOString()
      }, accessToken);
    } catch (logErr) {
      // Kalau cuma log yang gagal ditulis, jangan gagalin seluruh broadcast yang udah terkirim.
      console.error("gagal simpan broadcastLogs", logErr);
    }

    return json({
      ok: successCount > 0 || recipients.length === 0,
      target,
      totalRecipients: results.length,
      successCount,
      failedCount,
      results
    });
  } catch (err) {
    console.error("admin-broadcast-telegram error", err);
    return json({ ok: false, error: err?.message || "Terjadi kesalahan tak terduga di server." }, 500);
  }
}

function isPremium(user) {
  if (!user) return false;
  if (user.status && user.status !== "active") return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  const until = user.premiumUntil || user.expiredAt || null;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

async function sendTelegram(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    let response = null;
    try {
      response = await res.json();
    } catch {
      response = await res.text();
    }

    return {
      ok: res.ok,
      status: res.status,
      response
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: String(err?.message || err)
    };
  }
}

async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  url.searchParams.set("ts", String(Date.now()));
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firebase PUT ${path} gagal (${res.status}): ${body.slice(0, 180)}`);
  }
  return await res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function maskChatId(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function safeKey(value) {
  return String(value || "empty")
    .replaceAll(".", "_")
    .replaceAll("#", "_")
    .replaceAll("$", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_")
    .replaceAll("/", "_")
    .replaceAll(":", "_");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
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
