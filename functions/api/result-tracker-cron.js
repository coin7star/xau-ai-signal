import { buildTrackerSummary } from "./result-tracker.js";

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  if (!["GET", "POST"].includes(request.method)) {
    return json({ ok: false, error: "Method tidak didukung." }, 405);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "Live Data Engine belum tersambung." }, 500);

  const url = new URL(request.url);
  let body = {};
  if (request.method === "POST") {
    try { body = await request.json(); } catch { body = {}; }
  }

  const secret = env.RESULT_TRACKER_CRON_SECRET || "";
  const token = url.searchParams.get("token") || body.token || request.headers.get("x-result-cron-secret") || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

  if (!secret) {
    return json({ ok: false, error: "RESULT_TRACKER_CRON_SECRET belum diset di Cloudflare ENV." }, 500);
  }

  if (token !== secret) {
    return json({ ok: false, error: "Unauthorized. Cron secret tidak valid." }, 401);
  }

  const statusPath = "/xauusd/system/resultTrackerCron";
  const now = Date.now();
  const cooldownSec = Number(env.RESULT_TRACKER_CRON_COOLDOWN_SEC || 60);
  const status = await fbGet(dbUrl, statusPath);
  const lastRunMs = new Date(status?.lastRunAt || 0).getTime();

  if (Number.isFinite(lastRunMs) && lastRunMs > 0 && now - lastRunMs < cooldownSec * 1000) {
    return json({
      ok: true,
      skipped: true,
      reason: "COOLDOWN_ACTIVE",
      message: `Auto Result Cron sedang cooldown ${cooldownSec} detik.`,
      lastRunAt: status.lastRunAt,
      nextAllowedAt: new Date(lastRunMs + cooldownSec * 1000).toISOString(),
      dataSource: "MT5_VPS_LIVE_FEED_ONLY"
    });
  }

  const market = await fbGet(dbUrl, "/xauusd/latest");
  const sourceInfo = getMt5SourceInfo(market);
  const requireFreshMt5 = String(env.RESULT_TRACKER_REQUIRE_FRESH_MT5 || "true").toLowerCase() !== "false";
  const maxAgeSec = Number(env.RESULT_TRACKER_MT5_MAX_AGE_SEC || 1800);

  if (requireFreshMt5 && (!sourceInfo.isMt5Live || sourceInfo.ageSec > maxAgeSec)) {
    const payload = {
      lastRunAt: new Date(now).toISOString(),
      lastStatus: "MT5_FEED_NOT_FRESH",
      dataSource: "MT5_VPS_LIVE_FEED_ONLY",
      liveFeedAgeSec: sourceInfo.ageSec,
      liveFeedTime: sourceInfo.timeText,
      updatedCount: 0,
      resultAlertSentCount: 0
    };
    await fbPatch(dbUrl, statusPath, payload);
    return json({
      ok: true,
      skipped: true,
      reason: "MT5_FEED_NOT_FRESH",
      message: "Auto result tidak dijalankan karena live feed MT5/VPS belum fresh.",
      dataSource: "MT5_VPS_LIVE_FEED_ONLY",
      liveFeedAgeSec: sourceInfo.ageSec,
      liveFeedTime: sourceInfo.timeText,
      maxAgeSec
    });
  }

  const summary = await buildTrackerSummary(dbUrl, env, true);
  const result = {
    ok: true,
    source: "MT5_VPS_LIVE_FEED_ONLY",
    message: buildCronMessage(summary),
    ...summary
  };

  await fbPatch(dbUrl, statusPath, {
    lastRunAt: new Date(now).toISOString(),
    lastStatus: "OK",
    dataSource: "MT5_VPS_LIVE_FEED_ONLY",
    liveFeedAgeSec: sourceInfo.ageSec,
    liveFeedTime: sourceInfo.timeText,
    scanned: summary.scanned,
    updatedCount: summary.updatedCount,
    resultAlertSentCount: summary.resultAlertSentCount,
    resultAlertSkippedCount: summary.resultAlertSkippedCount,
    livePrice: summary.livePrice
  });

  return json(result);
}

function getMt5SourceInfo(market) {
  const source = String(market?.source || market?.mode || "mt5").toLowerCase();
  const timeValue = market?.receivedAt || market?.lastCandleTime || market?.serverTime || market?.updatedAt || market?.time || null;
  const t = new Date(timeValue || 0).getTime();
  const ageSec = Number.isFinite(t) && t > 0 ? Math.round((Date.now() - t) / 1000) : 999999;
  const isMt5Live = Boolean(market) && !source.includes("bybit") && !source.includes("test") && !source.includes("backup");
  return {
    source,
    isMt5Live,
    ageSec,
    timeText: timeValue || null
  };
}

function buildCronMessage(summary) {
  if (!summary.livePrice) return "Cron aktif, tapi live price MT5/VPS belum tersedia.";
  if (summary.updatedCount > 0) return `${summary.updatedCount} signal ditutup otomatis dari live feed MT5/VPS.`;
  if (summary.scanned > 0) return "Cron aktif. Semua signal masih RUNNING.";
  return "Cron aktif. Belum ada signal RUNNING untuk dipantau.";
}

async function fbGet(dbUrl, path) {
  const res = await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!res.ok) return null;
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
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
