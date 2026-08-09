/**
 * XAU AI Signal - Admin Dashboard Summary
 *
 * Tujuan:
 * - Kasih 1 ringkasan cepat buat admin: jumlah user (free/premium/admin),
 *   user baru, premium yang mau expire, dan revenue dari paymentOrders
 *   yang berstatus "approved" (7 hari / 30 hari / bulan berjalan / all-time).
 *
 * Auth:
 * - Authorization: Bearer <ADMIN_ACTION_TOKEN>  (sama seperti admin-user.js / admin-orders.js)
 *
 * Catatan:
 * - Pakai service account (sama pola dengan fungsi admin lain) supaya request
 *   ke Firebase RTDB dianggap "admin" dan tidak diblokir oleh security rules.
 * - Revenue dihitung dari field `order.price` yang formatnya teks seperti
 *   "Rp10K" / "Rp30K" -> di-parse jadi angka lewat parsePriceToNumber().
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "GET") return json({ ok: false, error: "Method tidak didukung." }, 405);

  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  const token = new URL(request.url).searchParams.get("token")
    || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    || "";
  if (!adminToken || token !== adminToken) return json({ ok: false, error: "Unauthorized admin token" }, 401);

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  let accessToken = null;
  try {
    const service = readServiceAccount(env);
    if (service) accessToken = await getGoogleAccessToken(service);
  } catch (e) {
    return json({ ok: false, error: `Gagal ambil Firebase service-account token: ${e?.message || e}` }, 500);
  }
  if (!accessToken) {
    return json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Cloudflare Pages env." }, 500);
  }

  try {
    const [usersRaw, ordersRaw] = await Promise.all([
      fbGet(dbUrl, "/users", accessToken),
      fbGet(dbUrl, "/paymentOrders", accessToken)
    ]);

    const users = Object.entries(usersRaw || {}).map(([uid, u]) => ({ uid, ...u }));
    const orders = Object.values(ordersRaw || {}).filter(Boolean);

    const now = Date.now();
    const d7 = now - 7 * ONE_DAY_MS;
    const d30 = now - 30 * ONE_DAY_MS;
    const monthStart = monthStartWIB(now);

    // ---- Users breakdown ----
    let totalFree = 0, totalPremiumActive = 0, totalAdmin = 0, expiredNotRenewed = 0;
    let newLast7Days = 0, newLast30Days = 0, expiringIn7Days = 0;

    for (const u of users) {
      const role = u.role || "free";
      if (role === "admin") {
        totalAdmin++;
      } else if (role === "premium") {
        const untilMs = u.premiumUntil ? new Date(u.premiumUntil).getTime() : NaN;
        if (Number.isFinite(untilMs) && untilMs > now) {
          totalPremiumActive++;
          if (untilMs <= now + 7 * ONE_DAY_MS) expiringIn7Days++;
        } else {
          expiredNotRenewed++;
        }
      } else {
        totalFree++;
      }

      const createdMs = u.createdAt ? new Date(u.createdAt).getTime() : NaN;
      if (Number.isFinite(createdMs)) {
        if (createdMs >= d7) newLast7Days++;
        if (createdMs >= d30) newLast30Days++;
      }
    }

    // ---- Orders / revenue breakdown (cuma status "approved" yang dihitung revenue) ----
    let pendingCount = 0, rejectedLast30Days = 0;
    let revenue7 = 0, revenue30 = 0, revenueMonth = 0, revenueAllTime = 0;
    let approved7 = 0, approved30 = 0, approvedMonth = 0;

    for (const o of orders) {
      const status = String(o.status || "pending").toLowerCase();

      if (status === "pending") { pendingCount++; continue; }

      if (status === "rejected") {
        const updMs = o.updatedAt ? new Date(o.updatedAt).getTime() : NaN;
        if (Number.isFinite(updMs) && updMs >= d30) rejectedLast30Days++;
        continue;
      }

      if (status === "approved") {
        const approvedMs = o.approvedAt ? new Date(o.approvedAt).getTime()
          : (o.updatedAt ? new Date(o.updatedAt).getTime() : NaN);
        const amount = parsePriceToNumber(o.price);

        revenueAllTime += amount;

        if (Number.isFinite(approvedMs)) {
          if (approvedMs >= d7) { revenue7 += amount; approved7++; }
          if (approvedMs >= d30) { revenue30 += amount; approved30++; }
          if (approvedMs >= monthStart) { revenueMonth += amount; approvedMonth++; }
        }
      }
    }

    return json({
      ok: true,
      generatedAt: new Date(now).toISOString(),
      users: {
        total: users.length,
        free: totalFree,
        premiumActive: totalPremiumActive,
        admin: totalAdmin,
        expiredNotRenewed,
        newLast7Days,
        newLast30Days
      },
      premium: {
        expiringIn7Days
      },
      revenue: {
        currency: "IDR",
        last7Days: revenue7,
        last30Days: revenue30,
        thisMonth: revenueMonth,
        allTimeApproved: revenueAllTime,
        approvedOrdersLast7Days: approved7,
        approvedOrdersLast30Days: approved30,
        approvedOrdersThisMonth: approvedMonth
      },
      orders: {
        pending: pendingCount,
        rejectedLast30Days
      }
    });
  } catch (e) {
    console.error("admin-dashboard-summary error", e);
    return json({ ok: false, error: e?.message || "Terjadi kesalahan tak terduga di server." }, 500);
  }
}

// Awal bulan berjalan, dihitung berdasarkan tanggal WIB (bukan UTC).
function monthStartWIB(refMs) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wib = new Date(refMs + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth();
  return Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS;
}

// order.price formatnya teks bebas, contoh: "Rp10K", "Rp30K", "Rp150.000", "50000".
// Fungsi ini nyoba nebak angka rupiah-nya sebaik mungkin.
function parsePriceToNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).toUpperCase();
  const m = s.match(/(\d[\d.,]*)\s*(RB|K|JT|M)?/);
  if (!m) return 0;
  let num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return 0;
  const suffix = m[2];
  if (suffix === "RB" || suffix === "K") num *= 1000;
  if (suffix === "JT" || suffix === "M") num *= 1000000;
  return Math.round(num);
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
