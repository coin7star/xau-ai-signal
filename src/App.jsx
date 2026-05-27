import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, ChevronUp, CircleDollarSign, Gauge, Radio, RefreshCcw, ShieldCheck, Sparkles, Zap } from "lucide-react";

const fallbackSignal = {
  pair: "XAUUSD",
  signal: "WAIT",
  entry: "-",
  sl: "-",
  tp: "-",
  confidence: "0%",
  reason: "Klik Generate Signal untuk meminta analisa AI terbaru.",
  mode: "manual",
  time: new Date().toISOString(),
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export default function App() {
  const [signal, setSignal] = useState(fallbackSignal);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("Ready to cook XAUUSD signal 🔥");

  const signalTone = useMemo(() => {
    if (signal.signal === "BUY") return "buy";
    if (signal.signal === "SELL") return "sell";
    return "wait";
  }, [signal.signal]);

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (Array.isArray(data.history)) setHistory(data.history);
    } catch {
      setHistory([]);
    }
  }

  async function generateSignal() {
    setLoading(true);
    setToast("AI lagi baca market gold...");
    try {
      const res = await fetch("/api/signal?fresh=1");
      const data = await res.json();
      setSignal(data);
      setToast(`${data.signal} ${data.pair} confidence ${data.confidence}`);
      await loadHistory();
    } catch (error) {
      setToast("Gagal ambil signal. Cek API / Cloudflare Functions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generateSignal();
  }, []);

  return (
    <main className="page-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />

      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon"><Sparkles size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>Gold trading assistant</span>
          </div>
        </div>
        <div className="nav-pill"><Radio size={16} /> Cloudflare Live</div>
      </nav>

      <section className="hero-grid">
        <div className="hero-card glass">
          <div className="eyebrow"><Bot size={16} /> AI CALL SIGNAL GEN Z</div>
          <h1>Dashboard sinyal XAUUSD yang nggak polos-polos amat 😭</h1>
          <p>
            Web ini jadi pusat sinyal AI untuk XAUUSD. MT5 nanti tinggal polling endpoint
            <code>/api/signal</code> dari Cloudflare Pages Functions.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={generateSignal} disabled={loading}>
              {loading ? <RefreshCcw className="spin" size={18} /> : <Zap size={18} />}
              {loading ? "Generating..." : "Generate Signal"}
            </button>
            <a className="ghost-btn" href="/api/signal" target="_blank">Test API</a>
          </div>
          <div className="toast">{toast}</div>
        </div>

        <div className={classNames("signal-card glass", signalTone)}>
          <div className="signal-top">
            <span>{signal.pair || "XAUUSD"}</span>
            <small>{new Date(signal.time || Date.now()).toLocaleString()}</small>
          </div>
          <div className="signal-main">
            <h2>{signal.signal || "WAIT"}</h2>
            <div className="confidence"><Gauge size={18} /> {signal.confidence || "0%"}</div>
          </div>
          <div className="price-grid">
            <div><span>Entry</span><b>{signal.entry}</b></div>
            <div><span>Stop Loss</span><b>{signal.sl}</b></div>
            <div><span>Take Profit</span><b>{signal.tp}</b></div>
          </div>
          <p className="reason">{signal.reason}</p>
        </div>
      </section>

      <section className="stats-grid">
        <div className="mini-card glass"><Activity /><span>Mode</span><b>{signal.mode || "AI"}</b></div>
        <div className="mini-card glass"><ShieldCheck /><span>Risk</span><b>Demo First</b></div>
        <div className="mini-card glass"><CircleDollarSign /><span>Pair</span><b>XAUUSD</b></div>
        <div className="mini-card glass"><ChevronUp /><span>Version</span><b>v1.1</b></div>
      </section>

      <section className="history-card glass">
        <div className="section-title">
          <h3>Signal History</h3>
          <button onClick={loadHistory}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Pair</th><th>Signal</th><th>Entry</th><th>SL</th><th>TP</th><th>Conf</th></tr>
            </thead>
            <tbody>
              {(history.length ? history : [signal]).slice(0, 10).map((item, index) => (
                <tr key={index}>
                  <td>{new Date(item.time || Date.now()).toLocaleTimeString()}</td>
                  <td>{item.pair || "XAUUSD"}</td>
                  <td><span className={classNames("badge", (item.signal || "WAIT").toLowerCase())}>{item.signal}</span></td>
                  <td>{item.entry}</td><td>{item.sl}</td><td>{item.tp}</td><td>{item.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        Bukan financial advice. Test demo dulu, XAUUSD galak bro 😭
      </footer>
    </main>
  );
}
