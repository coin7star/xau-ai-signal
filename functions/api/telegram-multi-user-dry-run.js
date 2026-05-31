const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const adminToken = env.ADMIN_ACTION_TOKEN || "";

  if (!dbUrl) return json({ ok: false, error: "FIREBASE_DATABASE_URL belum diset" }, 500);

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

  const signalType = String(body.signalType || "MAIN_SIGNAL").toUpperCase();
  const signalLabel = String(body.signalLabel || "Auto Signal Dry Run").slice(0, 80);
  const alertKind = String(body.alertKind || "main").toLowerCase();

  const usersRaw = await fbGet(dbUrl, "/users");
  const users = Object.values(usersRaw || {}).filter(Boolean);

  const seenChatIds = new Set();
  const eligible = [];
  const skipped = [];

  for (const user of users) {
    const decision = evaluateReceiver(user, alertKind, seenChatIds);
    const item = {
      uid: user.uid || null,
      email: user.email || null,
      role: user.role || "free",
      chatId: maskChatId(user.telegramChatId),
      telegramUsername: user.telegramUsername || null,
      alertMain: user.telegramAlertMainSignal !== false,
      alertResult: user.telegramAlertResult !== false,
      reason: decision.reason
    };

    if (decision.ok) {
      eligible.push({ ...item, status: "READY" });
      seenChatIds.add(String(user.telegramChatId || ""));
    } else {
      skipped.push({ ...item, status: "SKIPPED" });
    }
  }

  const createdAt = new Date().toISOString();
  const summary = {
    ok: true,
    dryRun: true,
    signalType,
    signalLabel,
    alertKind,
    totalUsers: users.length,
    eligibleCount: eligible.length,
    skippedCount: skipped.length,
    eligible: eligible.slice(0, 50),
    skipped: skipped.slice(0, 50),
    note: "Dry run saja. Tidak ada pesan Telegram yang dikirim.",
    createdAt
  };

  await fbPut(dbUrl, "/xauusd/telegram/multiUserDryRun/latest", {
    ...summary,
    eligible: eligible.slice(0, 20),
    skipped: skipped.slice(0, 20)
  });

  return json(summary);
}

function evaluateReceiver(user, alertKind, seenChatIds) {
  if (!user) return { ok: false, reason: "User data kosong" };
  if (user.status && user.status !== "active") return { ok: false, reason: "Akun tidak aktif" };
  if (!isPremium(user)) return { ok: false, reason: "Bukan premium/admin aktif" };
  if (!user.telegramConnected || !user.telegramChatId) return { ok: false, reason: "Telegram belum terhubung" };

  const chatId = String(user.telegramChatId || "");
  if (seenChatIds.has(chatId)) return { ok: false, reason: "Chat ID duplikat" };

  if (user.telegramAlertEnabled === false) return { ok: false, reason: "Alert dimatikan user" };
  if (alertKind === "result" && user.telegramAlertResult === false) return { ok: false, reason: "Result Alert OFF" };
  if (alertKind !== "result" && user.telegramAlertMainSignal === false) return { ok: false, reason: "Main Signal Alert OFF" };

  return { ok: true, reason: "Premium/admin aktif, Telegram connected, alert ON" };
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

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
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

function maskChatId(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
