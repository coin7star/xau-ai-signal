import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { get, getDatabase, ref, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};


function getPublicAppUrlForAuthActions() {
  return (
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.APP_URL ||
    import.meta.env.DASHBOARD_URL ||
    window.location.origin
  ).replace(/\/$/, "");
}

function getAuthActionSettings() {
  return {
    url: `${getPublicAppUrlForAuthActions()}/auth-action`,
    handleCodeInApp: false
  };
}

export const hasFirebaseClientConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const app = hasFirebaseClientConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export function listenAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new Error("Firebase client ENV belum lengkap.");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  return credential;
}

export async function resetPasswordEmail(email) {
  if (!auth) throw new Error("Firebase client ENV belum lengkap.");
  if (!email) throw new Error("Isi email akun kamu dulu.");

  const response = await fetch("/api/custom-reset-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    const errorMessage = data?.error || data?.message || "Gagal mengirim email reset custom.";
    throw new Error(errorMessage);
  }

  return { ok: true, customEmail: true };
}

export async function registerWithEmail(email, password) {
  if (!auth || !db) throw new Error("Firebase client ENV belum lengkap.");

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  await sendVerificationEmail(credential.user);

  return credential;
}

export async function loginWithGoogle() {
  if (!auth || !db) throw new Error("Firebase client ENV belum lengkap.");

  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await ensureUserProfile(credential.user);

  return credential;
}

export async function logout() {
  if (!auth) return;
  await signOut(auth);
}

export async function sendVerificationEmail(user = auth?.currentUser) {
  if (!user) throw new Error("User belum login.");
  if (user.emailVerified) return { ok: true, skipped: "already-verified" };

  const email = user.email || "";
  if (!email) throw new Error("Email user tidak tersedia.");

  const response = await fetch("/api/custom-verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    const errorMessage = data?.error || data?.message || "Gagal mengirim email verifikasi custom.";
    throw new Error(errorMessage);
  }

  return { ok: true, customEmail: true };
}


export async function refreshCurrentUser() {
  if (!auth?.currentUser) return null;

  await reload(auth.currentUser);
  await ensureUserProfile(auth.currentUser);

  return auth.currentUser;
}

const REFERRAL_STORAGE_KEY = "xau_pending_ref_code";
const WELCOME_VOUCHER_STORAGE_KEY = "xau_welcome_voucher";

// Step Referral: simpan kode ?ref=KODE dari URL begitu halaman dibuka,
// biar tetap kebawa walau user baru daftar setelah beberapa langkah
// (buka landing -> klik daftar -> isi form -> verifikasi email, dst).
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && code.trim()) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, code.trim().toUpperCase());
    }
  } catch {
    // localStorage tidak tersedia (mis. private mode ekstrem) -> abaikan, bukan fitur kritis
  }
}

// Step Referral bugfix: voucher welcome yang dibalikin server (action=link)
// sebelumnya cuma dibuang gitu aja - user daftar lewat link ref tapi ga
// pernah lihat kode vouchernya sama sekali. Sekarang disimpan di
// localStorage biar bisa ditampilkan + auto-diisi di halaman Premium.
export function getPendingWelcomeVoucher() {
  try {
    const raw = localStorage.getItem(WELCOME_VOUCHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(WELCOME_VOUCHER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingWelcomeVoucher() {
  try { localStorage.removeItem(WELCOME_VOUCHER_STORAGE_KEY); } catch { /* noop */ }
}

async function linkPendingReferral(user) {
  if (!user) return;
  let code = "";
  try { code = localStorage.getItem(REFERRAL_STORAGE_KEY) || ""; } catch { return; }
  if (!code) return;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action: "link", code })
    });
    const data = await res.json().catch(() => ({}));
    if (data?.ok && data?.welcomeVoucher?.code) {
      try { localStorage.setItem(WELCOME_VOUCHER_STORAGE_KEY, JSON.stringify(data.welcomeVoucher)); } catch { /* noop */ }
    }
  } catch {
    // gagal link referral tidak boleh menggagalkan proses registrasi
  } finally {
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch { /* noop */ }
  }
}

export async function getMyReferral(user) {
  if (!user) throw new Error("User belum login.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/referral", { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Gagal memuat data referral.");
  return data;
}

export async function ensureUserProfile(user) {
  if (!db || !user) return null;

  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    const now = new Date().toISOString();

    const profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: Boolean(user.emailVerified),
      role: "free",
      status: "active",
      premiumUntil: null,
      createdAt: now,
      updatedAt: now
    };

    await set(userRef, profile);
    await linkPendingReferral(user); // akun baru -> coba sambungkan ke referral yang pending
    return profile;
  }

  const current = snapshot.val() || {};

  const patch = {
    email: user.email || current.email || "",
    displayName: user.displayName || current.displayName || "",
    photoURL: user.photoURL || current.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await update(userRef, patch);

  return {
    ...current,
    ...patch
  };
}

export async function getUserProfile(uid) {
  if (!auth?.currentUser || !uid) return null;

  const idToken = await auth.currentUser.getIdToken(true);
  let apiError = null;

  // Primary path: Cloudflare API reads the exact legacy /users/{uid} record.
  try {
    const response = await fetch(`/api/user-profile?uid=${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.ok && data.profile) {
      if (!data.profile.role) throw new Error("Profile terbaca tetapi field role tidak ada.");
      return data.profile;
    }
    apiError = new Error(data?.error || `Profile API gagal (${response.status})`);
  } catch (error) {
    apiError = error;
  }

  // Safety fallback: use the same Firebase RTDB record directly. This keeps
  // the new UI compatible with the old app even if a Cloudflare Function/env
  // is temporarily unavailable. Firebase Security Rules still apply here.
  try {
    if (db) {
      const snapshot = await get(ref(db, `users/${uid}`));
      if (snapshot.exists()) {
        const directProfile = snapshot.val() || null;
        if (directProfile && !directProfile.role) throw new Error("Profile terbaca tetapi field role tidak ada.");
        return directProfile;
      }
    }
  } catch (fallbackError) {
    throw new Error(
      apiError?.message || fallbackError?.message || "Gagal membaca profile user."
    );
  }

  throw apiError || new Error("Profile user tidak ditemukan.");
}

export function isPremiumProfile(profile) {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.role !== "premium") return false;

  const until = profile.premiumUntil || profile.expiredAt || null;
  if (!until) return false;

  return new Date(until).getTime() > Date.now();
}

// Step Kontak-Admin: manual dulu (belum pakai payment gateway) - user kirim
// bukti transfer langsung ke admin lewat WhatsApp/Telegram. Nomor & username
// diatur lewat env Cloudflare Pages (VITE_ADMIN_WHATSAPP / VITE_ADMIN_TELEGRAM),
// jadi gampang diganti tanpa ubah kode kalau nanti pindah ke Xendit dkk.
export function getAdminContact() {
  const rawWhatsapp = String(import.meta.env.VITE_ADMIN_WHATSAPP || "").replace(/[^0-9]/g, "");
  const whatsapp = rawWhatsapp ? (rawWhatsapp.startsWith("0") ? `62${rawWhatsapp.slice(1)}` : rawWhatsapp) : "";
  const telegram = String(import.meta.env.VITE_ADMIN_TELEGRAM || "").replace(/^@/, "").trim();
  return { whatsapp: whatsapp || null, telegram: telegram || null };
}

export function buildPaymentProofMessage({ orderId, packageLabel, price, email }) {
  const lines = [
    "Halo Admin XAU AI Signal, saya mau kirim bukti pembayaran.",
    `Order ID: ${orderId || "-"}`,
    `Paket: ${packageLabel || "-"}`,
    `Total: ${price || "-"}`,
    email ? `Email akun: ${email}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}


// Step Voucher-1: cek kode voucher secara publik (tanpa mengunci pemakaian)
// buat nampilin preview "harga setelah diskon" real-time pas user ngetik kode.
export async function checkVoucher({ code, packageCode }) {
  const qs = new URLSearchParams({ code: code || "", packageCode: packageCode || "" });
  const res = await fetch(`/api/voucher?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Kode voucher tidak valid.");
  return data;
}

// Step Voucher-2: kunci pemakaian voucher (increment usedCount + catat uid)
// tepat sebelum order dibuat, biar 1 kode = 1x pakai per user & tidak lewat kuota.
export async function redeemVoucher({ user, code, packageCode }) {
  if (!user?.uid) throw new Error("User belum login.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/voucher", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: "redeem", code, packageCode })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Gagal memakai kode voucher.");
  return data;
}

// Step Anti-Nyangkut: dulu kalau user masih punya order pending, klik "Beli"
// paket lain cuma balikin order LAMA itu lagi (tidak bikin order baru) -
// akibatnya kalau user emang niat ganti paket/pakai voucher baru, order
// lamanya nyangkut terus dan bikin bingung (dan numpuk di Firebase kalau
// gak pernah dibayar/diproses admin). Sekarang: order pending lama milik
// user ini (kalau ada) DIHAPUS dulu lewat endpoint server (client tidak
// diizinkan hapus langsung oleh security rules), baru order baru dibuat.
// User sudah diperingatkan soal ini di dialog konfirmasi sebelum sampai sini.
export async function cancelPendingPaymentOrders({ user }) {
  if (!user?.uid) throw new Error("User belum login.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/payment-order-cancel-pending", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Gagal membatalkan order pending sebelumnya.");
  return data;
}

export async function createPaymentOrder({ user, profile, packageCode, packageLabel, price, voucher }) {
  if (!db) throw new Error("Firebase client ENV belum lengkap.");
  if (!user?.uid) throw new Error("User belum login.");

  // Hapus dulu order pending lama (kalau ada) supaya tidak numpuk & tidak
  // ada 2 order nyangkut bersamaan punya user yang sama. Non-fatal: kalau
  // gagal (mis. network flaky), tetap lanjut bikin order baru - toh rule
  // RTDB cuma cek unik per-orderId, jadi order baru tetap bisa dibuat.
  try {
    await cancelPendingPaymentOrders({ user });
  } catch {
    // diamkan, order baru tetap dilanjutkan di bawah
  }

  const now = new Date().toISOString();
  const cleanPackage = String(packageCode || "30D").toUpperCase();
  const orderId = `${user.uid}_${Date.now()}`;

  const order = {
    orderId,
    uid: user.uid,
    email: user.email || profile?.email || "",
    packageCode: cleanPackage,
    packageLabel: packageLabel || (cleanPackage === "7D" ? "7 Day" : "30 Day"),
    price: price || (cleanPackage === "7D" ? "Rp10K" : "Rp30K"),
    status: "pending",
    source: "paywall",
    ...(voucher ? {
      voucherCode: voucher.voucherCode,
      voucherLabel: voucher.voucherLabel || null,
      originalPrice: voucher.originalPriceLabel || null
    } : {}),
    createdAt: now,
    updatedAt: now
  };

  try {
    await set(ref(db, `paymentOrders/${orderId}`), order);
  } catch (err) {
    throw new Error(`Gagal simpan order baru ke /paymentOrders (${err?.code || err?.message || err}). Order belum dibuat, voucher (kalau dipakai) mohon dicek manual ke admin.`);
  }

  try {
    await update(ref(db, `users/${user.uid}`), {
      lastPaymentOrderId: orderId,
      lastPaymentPackage: order.packageLabel,
      lastPaymentPrice: order.price,
      lastPaymentStatus: "pending",
      lastPaymentCreatedAt: now,
      updatedAt: now
    });
  } catch (err) {
    // Order-nya sendiri SUDAH kesimpen di /paymentOrders (baris di atas berhasil),
    // cuma gagal update pointer di /users/{uid}. Jangan disembunyikan sebagai
    // "gagal total" - order tetap ada & tetap bisa diproses admin manual.
    console.error("createPaymentOrder: order tersimpan tapi gagal update /users profile", err);
  }

  // Step 8D: notify admin via Telegram, non-blocking.
  // Kalau endpoint/env Telegram error, order tetap berhasil dibuat.
  try {
    fetch("/api/payment-order-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order })
    }).catch(() => {});
  } catch {
    // ignore notify error
  }

  return order;
}


export async function getUserPaymentOrders(uid) {
  if (!uid) throw new Error("UID user tidak ditemukan.");
  const user = auth.currentUser;
  if (!user) throw new Error("Kamu harus login dulu.");

  // Catatan: sengaja TIDAK baca /paymentOrders langsung lewat client SDK.
  // Firebase rules cuma kasih .read di level paymentOrders/$orderId, jadi
  // baca root "paymentOrders" langsung selalu kena PERMISSION_DENIED.
  // Endpoint ini pakai service account di server buat ambil & filter data
  // yang jadi milik user, tanpa perlu melonggarkan rules.
  const idToken = await user.getIdToken();
  const res = await fetch("/api/user-payment-orders", {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || "Gagal mengambil riwayat pembayaran.");
  }
  return data.orders || [];
}
