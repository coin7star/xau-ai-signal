const $ = (id) => document.getElementById(id);

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request gagal");
  return data;
}

function cls(action) {
  return action === "BUY" ? "buy" : action === "SELL" ? "sell" : "wait";
}

function fmt(x) {
  return Number(x || 0) ? Number(x).toFixed(3) : "-";
}

async function checkHealth() {
  try {
    await getJson("/api/health");
    $("healthDot").className = "dot ok";
    $("healthText").textContent = "Worker online";
  } catch {
    $("healthDot").className = "dot bad";
    $("healthText").textContent = "Worker error";
  }
}

async function loadSignal() {
  const data = await getJson("/api/signal?symbol=XAUUSD");
  if (data.empty) return;

  const s = data.signal;
  $("signalAction").textContent = s.action;
  $("signalAction").className = cls(s.action);
  $("entry").textContent = fmt(s.entry);
  $("sl").textContent = fmt(s.stopLoss);
  $("tp1").textContent = fmt(s.takeProfit1);
  $("tp2").textContent = fmt(s.takeProfit2);
  $("confidenceText").textContent = `${s.confidence}%`;
  $("confidenceBar").style.width = `${s.confidence}%`;
  $("reason").textContent = s.reason;
  $("riskNote").textContent = s.riskNote;
}

async function loadHistory() {
  const data = await getJson("/api/history?symbol=XAUUSD");
  $("history").innerHTML = data.history.map((s) => `
    <div class="item">
      <div class="pill ${cls(s.action)}">${s.action}</div>
      <div>
        <b>${s.symbol} • ${s.timeframe} • ${s.confidence}%</b><br>
        <small>${s.reason}</small>
      </div>
      <small>${new Date(s.createdAt).toLocaleString()}</small>
    </div>
  `).join("") || "<p class='muted'>Belum ada history.</p>";
}

async function manualSignal() {
  $("manualOutput").textContent = "Loading...";
  try {
    const payload = {
      symbol: "XAUUSD",
      timeframe: "M5",
      bid: Number($("bid").value),
      ask: Number($("ask").value),
      rsi: Number($("rsi").value),
      atr: Number($("atr").value),
      emaFast: Number($("emaFast").value),
      emaSlow: Number($("emaSlow").value),
      spreadPoints: 25,
      note: "Manual dashboard test"
    };

    const data = await getJson("/api/manual-signal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-app-secret": $("secret").value
      },
      body: JSON.stringify(payload)
    });

    $("manualOutput").textContent = JSON.stringify(data.signal, null, 2);
    await loadSignal();
    await loadHistory();
  } catch (e) {
    $("manualOutput").textContent = e.message;
  }
}

$("refreshBtn").addEventListener("click", async () => {
  await loadSignal();
  await loadHistory();
});

$("manualBtn").addEventListener("click", manualSignal);

checkHealth();
loadSignal().catch(() => {});
loadHistory().catch(() => {});
setInterval(() => {
  loadSignal().catch(() => {});
  loadHistory().catch(() => {});
}, 15000);
