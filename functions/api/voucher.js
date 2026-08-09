/**
 * XAU AI Signal - Voucher / Kode Diskon Instan
 *
 * Tujuan:
 * - GET ?code=XXX&packageCode=YYY (publik, tanpa login): user ngetik kode
 *   voucher di PremiumBox buat "cek" apakah kodenya valid + liat berapa
 *   potongan harganya SEBELUM dia beli. Ini yang bikin penasaran & tertarik
 *   checkout (real-time discount preview).
 * - GET dengan Authorization: Bearer <ADMIN_ACTION_TOKEN>: dipanggil admin
 *   panel, balikin SEMUA voucher (termasuk nonaktif/habis) buat dikelola.
 * - POST { action:"redeem" } + Authorization: Bearer <Firebase ID token>:
 *   dipanggil pas user klik "Beli" - ngunci pemakaian voucher (increment
 *   usedCount, catat siapa yang pakai) baru bikin payment order pakai
 *   harga yang sudah didiskon. Mencegah 1 user pakai kode yang sama
 *   berkali-kali dan mencegah voucher kepakai lebih dari maxUses.
 * - POST { action:"save"|"delete" } + Authorization: Bearer <ADMIN_ACTION_TOKEN>:
 *   dipanggil admin panel buat bikin/edit/hapus voucher.
 *
 * Data disimpan di RTDB: /vouchers/{CODE}
 * Node ini TIDAK ada di security rules publik (users/signals/paymentOrders
 * saja yang diizinkan) - artinya client SDK selalu PERMISSION_DENIED kalau
 * coba akses langsung. Endpoint ini satu-satunya jalan masuk, dan selalu
 * pakai service-account access token (pola sama persis dengan pricing.js).
 */

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

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

  const admin = isAdminRequest(request, env);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));

    if (!code) {
      // Tanpa kode -> hanya admin yang boleh liat daftar penuh.
      if (!admin) return json({ ok: false, error: "Kode voucher wajib diisi" }, 400);
      const raw = await fbGet(dbUrl, "/vouchers", accessToken);
      const list = raw && typeof raw === "object" ? Object.values(raw).filter(Boolean) : [];
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return json({ ok: true, vouchers: list.map(stripRedemptions) });
    }

    // Preview publik: validasi kode + hitung estimasi harga diskon.
    const packageCode = normalizeCode(url.searchParams.get("packageCode"));
    const voucher = await fbGet(dbUrl, `/vouchers/${code}`, accessToken);
    const check = evaluateVoucher(voucher);
    if (!check.ok) return json({ ok: false, error: check.error }, 200);

    let pkg = null;
    if (packageCode) {
      pkg = await fbGet(dbUrl, `/pricing/packages/${packageCode}`, accessToken);
    }

    const preview = buildDiscountPreview(voucher, pkg);
    return json({
      ok: true,
      voucher: { code: voucher.code, label: voucher.label, discountType: voucher.discountType, discountValue: voucher.discountValue },
      ...preview
    });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON tidak valid" }, 400);
  }

  const action = String(body.action || "save").toLowerCase();

  if (action === "redeem") {
    return await handleRedeem({ request, env, dbUrl, accessToken, body });
  }

  // Sisanya (save/delete) khusus admin.
  if (!admin) return json({ ok: false, error: "Unauthorized admin token" }, 401);

  const code = normalizeCode(body.code);
  if (!code) return json({ ok: false, error: "Kode voucher wajib diisi (huruf/angka, contoh: DISKON20)" }, 400);

  if (action === "delete") {
    await fbDelete(dbUrl, `/vouchers/${code}`, accessToken);
    return json({ ok: true, deleted: code });
  }

  const existing = (await fbGet(dbUrl, `/vouchers/${code}`, accessToken)) || {};
  const now = new Date().toISOString();

  const discountType = body.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = Number(body.discountValue ?? existing.discountValue ?? 0);
  if (!discountValue || discountValue <= 0) {
    return json({ ok: false, error: "Nilai diskon wajib diisi & harus lebih dari 0" }, 400);
  }
  if (discountType === "percent" && discountValue > 95) {
    return json({ ok: false, error: "Diskon persen maksimal 95%" }, 400);
  }

  const maxUsesRaw = body.maxUses === "" || body.maxUses === undefined ? existing.maxUses ?? null : body.maxUses;
  const maxUses = maxUsesRaw === null || maxUsesRaw === "" ? null : Math.max(1, Number(maxUsesRaw) || 1);

  const voucher = {
    code,
    label: safeText(body.label || existing.label || `Diskon ${code}`).slice(0, 60),
    discountType,
    discountValue,
    packageCode: normalizeCode(body.packageCode || existing.packageCode || "") || null, // null = berlaku semua paket
    maxUses,
    usedCount: Number(existing.usedCount) || 0,
    active: body.active !== undefined ? !!body.active : existing.active !== false,
    expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : (existing.expiresAt || null),
    redeemedBy: existing.redeemedBy || null,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };

  await fbPut(dbUrl, `/vouchers/${code}`, voucher, accessToken);
  return json({ ok: true, voucher: stripRedemptions(voucher) });
}

async function handleRedeem({ request, env, dbUrl, accessToken, body }) {
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return json({ ok: false, error: "Kamu harus login dulu." }, 401);

  const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || "";
  const uid = await verifyFirebaseIdToken(idToken, apiKey);
  if (!uid) return json({ ok: false, error: "Session login tidak valid, silakan login ulang." }, 401);

  const code = normalizeCode(body.code);
  const packageCode = normalizeCode(body.packageCode);
  if (!code) return json({ ok: false, error: "Kode voucher wajib diisi." }, 400);
  if (!packageCode) return json({ ok: false, error: "Paket wajib dipilih." }, 400);

  const voucher = await fbGet(dbUrl, `/vouchers/${code}`, accessToken);
  const check = evaluateVoucher(voucher, packageCode);
  if (!check.ok) return json({ ok: false, error: check.error }, 200);

  const redeemedBy = voucher.redeemedBy || {};
  if (redeemedBy[uid]) {
    return json({ ok: false, error: "Kamu sudah pernah pakai kode voucher ini sebelumnya." }, 200);
  }

  const pkg = await fbGet(dbUrl, `/pricing/packages/${packageCode}`, accessToken);
  if (!pkg) return json({ ok: false, error: "Paket tidak ditemukan." }, 200);

  const preview = buildDiscountPreview(voucher, pkg);
  if (!preview.discountedPriceLabel) {
    return json({ ok: false, error: "Gagal menghitung harga diskon." }, 200);
  }

  const now = new Date().toISOString();
  const updated = {
    ...voucher,
    usedCount: (Number(voucher.usedCount) || 0) + 1,
    redeemedBy: { ...redeemedBy, [uid]: now },
    updatedAt: now
  };
  await fbPut(dbUrl, `/vouchers/${code}`, updated, accessToken);

  return json({
    ok: true,
    redemptionId: `${code}_${uid}_${Date.now()}`,
    voucherCode: code,
    voucherLabel: voucher.label,
    ...preview
  });
}

// ---- Voucher logic helpers ----

function evaluateVoucher(voucher, packageCode) {
  if (!voucher) return { ok: false, error: "Kode voucher tidak ditemukan." };
  if (voucher.active === false) return { ok: false, error: "Voucher ini sudah tidak aktif." };
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Voucher ini sudah kedaluwarsa." };
  }
  if (voucher.maxUses !== null && voucher.maxUses !== undefined) {
    if ((Number(voucher.usedCount) || 0) >= Number(voucher.maxUses)) {
      return { ok: false, error: "Kuota voucher ini sudah habis." };
    }
  }
  if (voucher.packageCode && packageCode && voucher.packageCode !== packageCode) {
    return { ok: false, error: `Voucher ini cuma berlaku untuk paket ${voucher.packageCode}.` };
  }
  return { ok: true };
}

function buildDiscountPreview(voucher, pkg) {
  if (!pkg || !pkg.priceLabel) return { originalPriceLabel: null, discountedPriceLabel: null, savingsLabel: null };
  const originalAmount = parseRupiah(pkg.priceLabel);
  if (!originalAmount) return { originalPriceLabel: pkg.priceLabel, discountedPriceLabel: pkg.priceLabel, savingsLabel: null };

  let discounted = originalAmount;
  if (voucher.discountType === "fixed") {
    discounted = Math.max(0, originalAmount - Number(voucher.discountValue || 0));
  } else {
    const pct = Math.min(95, Number(voucher.discountValue || 0));
    discounted = Math.round(originalAmount * (1 - pct / 100));
  }
  const savings = Math.max(0, originalAmount - discounted);

  return {
    originalPriceLabel: pkg.priceLabel,
    discountedPriceLabel: formatRupiah(discounted),
    savingsLabel: savings > 0 ? formatRupiah(savings) : null,
    packageLabel: pkg.label || pkg.code
  };
}

function parseRupiah(label) {
  let s = String(label || "").trim().toLowerCase().replace(/rp/g, "").trim();
  if (!s) return 0;
  let multiplier = 1;
  if (/jt|juta/.test(s)) { multiplier = 1000000; s = s.replace(/jt|juta/g, ""); }
  else if (/rb|k/.test(s)) { multiplier = 1000; s = s.replace(/rb|k/g, ""); }
  s = s.replace(/[.,\s]/g, "").replace(/[^0-9]/g, "");
  const num = parseInt(s, 10);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * multiplier);
}

function formatRupiah(amount) {
  if (amount >= 1000 && amount % 1000 === 0) return `Rp${amount / 1000}K`;
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function normalizeCode(v) {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function stripRedemptions(voucher) {
  const { redeemedBy, ...rest } = voucher || {};
  return { ...rest, redeemedCount: redeemedBy ? Object.keys(redeemedBy).length : 0 };
}

function isAdminRequest(request, env) {
  const adminToken = env.ADMIN_ACTION_TOKEN || env.VITE_ADMIN_ACTION_TOKEN || "";
  if (!adminToken) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || new URL(request.url).searchParams.get("token")
    || "";
  return token === adminToken;
}

function safeText(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
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
  if (accessToken) url.searchParams.set("access_token", accessToken);
  url.searchParams.set("ts", String(Date.now()));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Firebase GET failed ${res.status}`);
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
    const text = await res.text();
    throw new Error(`Firebase PUT failed ${res.status}: ${text}`);
  }
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}

// ---- Firebase service-account OAuth (sama pola dengan pricing.js) ----
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
