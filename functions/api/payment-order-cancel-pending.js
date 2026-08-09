/**
 * XAU AI Signal - Batalin Order Pending Lama Punya Sendiri
 *
 * Tujuan:
 * - Dipanggil otomatis oleh client TEPAT SEBELUM bikin order baru (lihat
 *   createPaymentOrder di src/firebaseClient.js), supaya order pending lama
 *   milik user yang sama langsung DIHAPUS (bukan cuma diganti statusnya),
 *   biar:
 *   1) Firebase /paymentOrders tidak numpuk order "nyangkut" yang gak
 *      pernah dibayar/diproses admin.
 *   2) Gak ada lagi kasus order lama & order baru sama-sama nyangkut di
 *      /users/{uid} (lastPaymentOrderId ketimpa tapi order lamanya masih
 *      hidup) yang bikin dashboard/admin bingung order mana yang valid.
 *
 * Kenapa perlu endpoint server (bukan langsung dihapus dari client)?
 * Security rules RTDB buat /paymentOrders/$orderId cuma ngasih izin CREATE
 * (".write": "... && !data.exists() ..."), jadi client TIDAK PERNAH bisa
 * menghapus/mengubah order yang sudah ada - termasuk order pending miliknya
 * sendiri. Makanya endpoint ini jalan pakai service-account access token
 * (pola sama persis dengan admin-orders.js / user-payment-orders.js) supaya
 * bisa menghapus, tapi tetap dibatasi ke uid pemilik token login yang valid
 * saja (tidak bisa dipakai buat hapus order user lain).
 *
 * Auth: Authorization: Bearer <Firebase ID token> (punya user sendiri, BUKAN
 * admin token) - jadi user cuma bisa hapus order pending miliknya sendiri.
 *
 * Catatan penting soal voucher: endpoint ini SENGAJA TIDAK mengembalikan
 * kuota voucher yang sudah kepakai di order lama itu. Voucher dikunci
 * (usedCount++, redeemedBy[uid] dicatat) di /api/voucher saat redeem, jauh
 * sebelum order dibuat - begitu kepakai, dianggap hangus permanen walau
 * order-nya sendiri akhirnya dihapus/dibatalkan. Ini juga harus diinfokan
 * ke user di UI (lihat warning di App.jsx) SEBELUM dia klik "Konfirmasi &
 * Beli", supaya user tidak salah pilih paket & rugi kuota voucher.
 */

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
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

  try {
    const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!idToken) return json({ ok: false, error: "Kamu harus login dulu." }, 401);

    const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
    const uid = await verifyFirebaseIdToken(idToken, apiKey);
    if (!uid) return json({ ok: false, error: "Session login tidak valid, silakan login ulang." }, 401);

    const service = readServiceAccount(env);
    if (!service) return json({ ok: false, error: "FIREBASE_SERVICE_ACCOUNT_JSON belum diset di Cloudflare Pages env." }, 500);
    const accessToken = await getGoogleAccessToken(service);

    const allOrders = (await fbGet(dbUrl, "/paymentOrders", accessToken)) || {};

    // Cuma order PENDING milik uid ini yang boleh dihapus. Order yang sudah
    // approved/rejected tetap disimpan (riwayat transaksi & referral).
    const pendingOwn = Object.values(allOrders).filter(
      (order) => order && order.uid === uid && String(order.status || "pending").toLowerCase() === "pending"
    );

    const cancelledOrderIds = [];
    for (const order of pendingOwn) {
      const orderId = order.orderId;
      if (!orderId) continue;
      await fbDelete(dbUrl, `/paymentOrders/${orderId}`, accessToken);
      cancelledOrderIds.push(orderId);
    }

    // Bersihin juga pointer "order pending terakhir" di profil user, biar
    // gak ada referensi nyantol ke order yang barusan dihapus.
    if (cancelledOrderIds.length > 0) {
      await fbPatch(dbUrl, `/users/${uid}`, {
        lastPaymentOrderId: null,
        lastPaymentStatus: null,
        updatedAt: new Date().toISOString()
      }, accessToken);
    }

    return json({ ok: true, cancelledCount: cancelledOrderIds.length, cancelledOrderIds });
  } catch (error) {
    console.error("payment-order-cancel-pending error", error);
    return json({ ok: false, error: error?.message || "Terjadi kesalahan tak terduga di server." }, 500);
  }
}

async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY belum diset di Cloudflare.");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return "";
  return data?.users?.[0]?.localId || "";
}

// ---- Firebase RTDB REST helpers ----
async function fbGet(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts", String(Date.now()));
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) throw new Error(`Firebase GET failed ${res.status}`);
  return await res.json();
}

async function fbDelete(dbUrl, path, accessToken) {
  const url = new URL(`${dbUrl}${path}.json`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase DELETE failed ${res.status}: ${text}`);
  }
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: { ...H, "Cache-Control": "no-store" } });
}

// ---- Firebase service-account OAuth (sama pola dengan user-payment-orders.js) ----
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
