const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const dbUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!dbUrl) return json({ ok: false, error: "Live Data Engine belum tersambung." }, 500);

  if (request.method === "GET") {
    const summary = await buildTrackerSummary(dbUrl, env, false);
    return json({ ok: true, ...summary });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const adminToken = env.ADMIN_ACTION_TOKEN || "";
  const token = body.token || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

  if (adminToken && token !== adminToken) {
    return json({ ok: false, error: "Kode admin tidak valid." }, 401);
  }

  const summary = await buildTrackerSummary(dbUrl, env, true);
  return json({
    ok: true,
    message: buildMessage(summary),
    ...summary
  });
}

async function buildTrackerSummary(dbUrl, env, shouldUpdate) {
  const market = await fbGet(dbUrl, "/xauusd/latest");
  const livePrice = getMarketPrice(market);
  const maxItems = Number(env.RESULT_TRACKER_MAX_ITEMS || 20);
  const mainExpireHours = Number(env.RESULT_TRACKER_MAIN_EXPIRE_HOURS || 24);
  const scalpExpireHours = Number(env.RESULT_TRACKER_SCALP_EXPIRE_HOURS || 4);

  const [callRaw, scalpRaw] = await Promise.all([
    fbGet(dbUrl, "/xauusd/callHistory"),
    fbGet(dbUrl, "/xauusd/scalpHistory")
  ]);

  const callItems = Object.values(callRaw || {}).filter(Boolean);
  const scalpItems = Object.values(scalpRaw || {}).filter(Boolean);

  const allOpen = [
    ...callItems.map((item) => ({ ...item, trackerType: "MAIN_CALL", path: "/xauusd/callHistory", expireHours: mainExpireHours })),
    ...scalpItems.map((item) => ({ ...item, trackerType: "SCALP_M1", path: "/xauusd/scalpHistory", expireHours: scalpExpireHours }))
  ]
    .filter(isOpen)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .slice(0, maxItems);

  const checked = [];
  const updated = [];

  for (const item of allOpen) {
    const result = evaluateItem(item, livePrice);
    checked.push({
      id: item.id,
      type: item.trackerType,
      signal: item.signal,
      entry: toNumber(item.entry),
      sl: toNumber(item.sl),
      tp: toNumber(item.tp),
      status: result.result || "RUNNING",
      reason: result.note
    });

    if (shouldUpdate && result.result && item.id) {
      const closedAt = new Date().toISOString();
      const payload = {
        ...item,
        status: "CLOSED",
        result: result.result,
        closedAt,
        resultPrice: livePrice,
        resultSource: "AUTO_RESULT_ENGINE",
        resultCheckedAt: closedAt,
        note: result.note
      };

      delete payload.path;
      delete payload.expireHours;
      delete payload.trackerType;

      await fbPut(dbUrl, `${item.path}/${item.id}`, payload);
      updated.push({
        id: item.id,
        type: item.trackerType,
        result: result.result,
        price: livePrice,
        note: result.note
      });
    }
  }

  return {
    livePrice,
    scanned: allOpen.length,
    updatedCount: updated.length,
    updated,
    checked,
    mode: shouldUpdate ? "AUTO_UPDATE" : "PREVIEW",
    checkedAt: new Date().toISOString()
  };
}

function evaluateItem(item, livePrice) {
  const signal = String(item.signal || "").toUpperCase();
  const sl = toNumber(item.sl);
  const tp = toNumber(item.tp);

  if (!Number.isFinite(livePrice) || livePrice <= 0) {
    return { result: null, note: "Harga live belum tersedia." };
  }

  if (!Number.isFinite(sl) || !Number.isFinite(tp)) {
    return { result: null, note: "SL/TP belum lengkap." };
  }

  if (signal === "BUY") {
    if (livePrice >= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (livePrice <= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  if (signal === "SELL") {
    if (livePrice <= tp) return { result: "WIN", note: `TP tercapai otomatis di harga ${formatPrice(livePrice)}.` };
    if (livePrice >= sl) return { result: "LOSS", note: `SL tersentuh otomatis di harga ${formatPrice(livePrice)}.` };
  }

  const ageHours = getAgeHours(item.createdAt || item.candleTime || item.serverTime);
  const expireHours = Number(item.expireHours || 24);
  if (ageHours >= expireHours) {
    return { result: "EXPIRED", note: `Signal melewati batas waktu ${expireHours} jam tanpa menyentuh TP/SL.` };
  }

  return { result: null, note: "Masih berjalan. Belum menyentuh TP/SL." };
}

function isOpen(item) {
  const status = String(item?.status || "OPEN").toUpperCase();
  const result = String(item?.result || "").toUpperCase();
  return status !== "CLOSED" && !["WIN", "LOSS", "BE", "EXPIRED"].includes(result);
}

function getMarketPrice(market) {
  const direct = toNumber(market?.lastPrice ?? market?.price ?? market?.latest?.lastPrice ?? market?.m1?.lastPrice);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const candles = market?.m1 || market?.candles?.m1 || market?.candlesM1 || [];
  if (Array.isArray(candles) && candles.length) {
    const last = candles[candles.length - 1];
    const price = toNumber(last?.close ?? last?.c);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return 0;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function getAgeHours(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return 0;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function buildMessage(summary) {
  if (!summary.livePrice) return "Live price belum tersedia. Tracker belum bisa mengecek result.";
  if (summary.updatedCount > 0) return `${summary.updatedCount} signal berhasil ditutup otomatis.`;
  if (summary.scanned > 0) return "Semua signal masih berjalan. Belum ada TP/SL yang tersentuh.";
  return "Belum ada signal RUNNING untuk dicek.";
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...H, "Cache-Control": "no-store" }
  });
}
