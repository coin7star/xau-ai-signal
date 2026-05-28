import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Database, Radio, RefreshCcw, Shield, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";

export default function App() {
  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("-");

  async function loadAll() {
    try {
      setLoading(true);
      const [m, s] = await Promise.all([
        fetch("/api/market?ts=" + Date.now()).then((r) => r.json()),
        fetch("/api/signal?ts=" + Date.now()).then((r) => r.json())
      ]);
      setMarket(m);
      setSignal(s);
      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setMarket({ ok: false, message: err.message, candles: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, []);

  const candles = market?.candles || [];
  const lastCandle = candles[candles.length - 1];

  const chartData = useMemo(() => {
    return candles.slice(-90).map((c, i) => {
      const open = Number(c.open);
      const close = Number(c.close);
      const high = Number(c.high);
      const low = Number(c.low);
      const isBull = close >= open;
      return {
        idx: i + 1,
        time: String(c.time || "").slice(11, 16),
        open,
        close,
        high,
        low,
        wick: [low, high],
        body: [Math.min(open, close), Math.max(open, close)],
        isBull,
        candleColor: isBull ? "#19f28f" : "#ff4d6d",
        wickColor: isBull ? "#77ffd0" : "#ff9aac",
        volume: Number(c.volume || 0)
      };
    });
  }, [candles]);

  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const spread = market?.ask && market?.bid ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2) : "-";

  return (
    <main className="page">
      <header className="nav">
        <div className="brand">
          <div className="logo"><Bot size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>MT5 → Firebase realtime</span>
          </div>
        </div>
        <div className="live"><Radio size={14} /> Firebase Live</div>
      </header>

      <section className="hero">
        <div className="intro card">
          <span className="pill"><Zap size={15} /> REAL CANDLE COLOR</span>
          <h1>Candlestick merah hijau dari MT5 🔥</h1>
          <p>
            Candle bullish tampil hijau, bearish tampil merah. Data tetap realtime dari MetaTrader → Firebase → Web.
          </p>
          <div className="actions">
            <button onClick={loadAll} disabled={loading}>
              <RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}
            </button>
            <a href="/api/market" target="_blank">Open JSON</a>
          </div>
        </div>

        <div className={`signalBox card ${isBuy ? "buy" : isSell ? "sell" : "wait"}`}>
          <div className="signalTop">
            <b>{market?.symbol || "XAUUSD"}</b>
            <span>{lastUpdate}</span>
          </div>
          <h2>{signal?.signal || "WAIT"}</h2>
          <div className="confidence">{signal?.confidence || 0}% confidence</div>
          <div className="priceGrid">
            <div><small>Entry</small><strong>{signal?.entry || "-"}</strong></div>
            <div><small>Stop Loss</small><strong>{signal?.sl || "-"}</strong></div>
            <div><small>Take Profit</small><strong>{signal?.tp || "-"}</strong></div>
          </div>
          <p>{signal?.reason || "Menunggu candle MT5..."}</p>
        </div>
      </section>

      <section className="stats">
        <Info icon={<Database />} label="Store" value="Firebase RTDB" />
        <Info icon={<Activity />} label="Candle" value={`${candles.length} data`} />
        <Info icon={<Shield />} label="Spread" value={spread} />
        <Info icon={isBuy ? <TrendingUp /> : <TrendingDown />} label="Last Close" value={lastCandle?.close || "-"} />
      </section>

      <section className="chartWrap card">
        <div className="sectionTitle">
          <div>
            <h3>Realtime MT5 Candlestick</h3>
            <span>{market?.symbol || "XAUUSD"} · {market?.timeframe || "M1"} · Bid {market?.bid || "-"}</span>
          </div>
          <div className="legend">
            <b><i className="bullDot"></i> Bullish</b>
            <b><i className="bearDot"></i> Bearish</b>
            <em><span></span> Auto refresh 5s</em>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={430}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 25, left: 5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
              <XAxis dataKey="time" tick={{ fill: "#aab6d3", fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "#aab6d3", fontSize: 12 }} width={78} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={Number(lastCandle?.close || 0)} strokeDasharray="4 4" opacity={0.65} />

              <Bar dataKey="wick" barSize={2} radius={[2, 2, 2, 2]}>
                {chartData.map((entry, index) => (
                  <Cell key={`wick-${index}`} fill={entry.wickColor} />
                ))}
              </Bar>

              <Bar dataKey="body" barSize={10} radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell key={`body-${index}`} fill={entry.candleColor} />
                ))}
              </Bar>

              <Line type="monotone" dataKey="close" stroke="#9bdcff" strokeWidth={2} dot={false} opacity={0.45} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty">{market?.message || "Belum ada candle. Jalankan EA MT5 dulu."}</div>
        )}
      </section>

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className={`tooltip ${d.isBull ? "tipBull" : "tipBear"}`}>
      <b>{d.time} · {d.isBull ? "Bullish" : "Bearish"}</b>
      <span>Open: {d.open}</span>
      <span>High: {d.high}</span>
      <span>Low: {d.low}</span>
      <span>Close: {d.close}</span>
      <span>Volume: {d.volume}</span>
    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="info card">
      <span className="infoIcon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
