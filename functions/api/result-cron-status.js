const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  if (request.method !== "GET") {
    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "Live Data Engine belum tersambung." }, 500);

  const status = await fbGet(dbUrl, "/xauusd/system/resultTrackerCron");
  const now = Date.now();
  const lastRunMs = new Date(status?.lastRunAt || 0).getTime();
  const ageSec = Number.isFinite(lastRunMs) && lastRunMs > 0 ? Math.round((now - lastRunMs) / 1000) : null;
  const attentionAfterSec = Number(env.RESULT_TRACKER_CRON_ATTENTION_AFTER_SEC || 300);
  const staleFeedReason = status?.lastStatus === "MT5_FEED_NOT_FRESH";

  let health = "NOT_STARTED";
  let label = "Belum ada data cron";
  let tone = "standby";
  let action = "Tunggu cron PHP.ID jalan atau cek konfigurasi cron.";

  if (ageSec === null) {
    health = "NOT_STARTED";
  } else if (ageSec > attentionAfterSec) {
    health = "ATTENTION";
    label = "Perlu dicek";
    tone = "attention";
    action = "Cron belum update cukup lama. Cek cPanel/PHP.ID cron job.";
  } else if (staleFeedReason) {
    health = "STANDBY";
    label = "Standby";
    tone = "standby";
    action = "Cron aktif, tapi menunggu live feed MT5/VPS fresh.";
  } else if (status?.lastStatus === "OK") {
    health = "ONLINE";
    label = "Online";
    tone = "online";
    action = "Cron aktif dan siap menutup result otomatis.";
  } else {
    health = "STANDBY";
    label = "Standby";
    tone = "standby";
    action = "Cron aktif, status terakhir masih dipantau.";
  }

  return json({
    ok: true,
    health,
    label,
    tone,
    action,
    source: status?.dataSource || "MT5_VPS_LIVE_FEED_ONLY",
    bybitUsed: false,
    lastRunAt: status?.lastRunAt || null,
    lastStatus: status?.lastStatus || null,
    lastRunAgeSec: ageSec,
    liveFeedAgeSec: status?.liveFeedAgeSec ?? null,
    liveFeedTime: status?.liveFeedTime || null,
    livePrice: status?.livePrice || null,
    scanned: status?.scanned || 0,
    updatedCount: status?.updatedCount || 0,
    resultAlertSentCount: status?.resultAlertSentCount || 0,
    resultAlertSkippedCount: status?.resultAlertSkippedCount || 0,
    runner: status?.runner || null,
    attentionAfterSec,
    checkedAt: new Date(now).toISOString()
  });
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
  return await res.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
