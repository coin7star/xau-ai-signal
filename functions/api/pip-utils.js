// 1$ pergerakan harga XAUUSD = 10 pip.
// WIN  -> asumsi exit di Take Profit
// LOSS -> asumsi exit di Stop Loss
// BE   -> 0 pip
export function pipForSignal(s) {
  const result = String(s?.result || "").toUpperCase();
  if (!result || result === "BE") return 0;
  const entry = Number(s?.entry), sl = Number(s?.sl), tp = Number(s?.tp);
  if (!Number.isFinite(entry)) return 0;
  const isSell = String(s?.direction || "").toUpperCase() === "SELL";
  const exitPrice = result === "WIN" ? tp : result === "LOSS" ? sl : null;
  if (!Number.isFinite(exitPrice)) return 0;
  const diffUsd = isSell ? (entry - exitPrice) : (exitPrice - entry);
  return Math.round(diffUsd * 10 * 10) / 10; // 1$ = 10 pip, dibulatkan 1 desimal
}

export function statsFromList(list) {
  const items = (list || []).filter(Boolean);
  let wins = 0, losses = 0, be = 0, totalPip = 0;
  for (const item of items) {
    const r = String(item?.result || "").toUpperCase();
    if (r === "WIN") wins += 1;
    else if (r === "LOSS") losses += 1;
    else if (r === "BE") be += 1;
    totalPip += pipForSignal(item);
  }
  const total = wins + losses + be;
  const decisive = wins + losses;
  const winratePercent = decisive ? Math.round((wins / decisive) * 100) : 0;
  return { wins, losses, be, total, winratePercent, totalPip: Math.round(totalPip * 10) / 10 };
}

export function statsFromHistoryObj(historyObj) {
  return statsFromList(Object.values(historyObj || {}));
}

// --- Window waktu WIB (UTC+7) ---
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function periodWindowWIB(period, refDate = new Date()) {
  const wib = new Date(refDate.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth(), d = wib.getUTCDate();
  const todayMidnightWIB = Date.UTC(y, m, d, 0, 0, 0) - WIB_OFFSET_MS;

  if (period === "weekly") {
    const to = todayMidnightWIB;
    const from = to - 7 * 24 * 60 * 60 * 1000;
    return { from, to };
  }
  if (period === "monthly") {
    const firstOfThisMonthWIB = Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS;
    const firstOfPrevMonthWIB = Date.UTC(y, m - 1, 1, 0, 0, 0) - WIB_OFFSET_MS;
    return { from: firstOfPrevMonthWIB, to: firstOfThisMonthWIB };
  }
  // daily (default)
  const to = todayMidnightWIB;
  const from = to - 24 * 60 * 60 * 1000;
  return { from, to };
}

export function filterHistoryByWindow(historyObj, from, to) {
  const items = Object.values(historyObj || {}).filter(Boolean);
  return items.filter((item) => {
    const t = new Date(item.resultAt || item.closedAt || item.publishedAt || item.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= from && t < to;
  });
}
