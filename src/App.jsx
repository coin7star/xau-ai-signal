import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import {
  Activity,
  Bot,
  Brain,
  Database,
  Radio,
  RefreshCcw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap
} from "lucide-react";

export default function App() {
  const chartRef = useRef(null);
  const chartBoxRef = useRef(null);
  const candleSeriesRef = useRef(null);

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
  const tvCandles = useMemo(() => candlesToTradingView(candles), [candles]);
  const lastCandle = candles[candles.length - 1];
  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const spread = market?.ask && market?.bid
    ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2)
    : "-";

  useEffect(() => {
    if (!chartBoxRef.current) return;

    const chart = createChart(chartBoxRef.current, {
      width: chartBoxRef.current.clientWidth,
      height: 470,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#aeb9d8"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.075)" },
        horzLines: { color: "rgba(255,255,255,0.075)" }
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.14)",
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.14)",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: { mode: CrosshairMode.Normal }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#19f28f",
      downColor: "#ff4d6d",
      borderUpColor: "#19f28f",
      borderDownColor: "#ff4d6d",
      wickUpColor: "#77ffd0",
      wickDownColor: "#ff9aac",
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const ro = new ResizeObserver(() => {
      if (!chartBoxRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: chartBoxRef.current.clientWidth });
    });

    ro.observe(chartBoxRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current || !tvCandles.length) return;

    candleSeriesRef.current.setData(tvCandles);
    chartRef.current.timeScale().fitContent();
  }, [tvCandles]);

  return (
    <main className="page">
      <header className="nav">
        <div className="brand">
          <div className="logo"><Bot size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>RSI · EMA Cross 9/20 · Order Block</span>
          </div>
        </div>
        <div className="live"><Radio size={14} /> Firebase Live</div>
      </header>

      <section className="hero">
        <div className="intro card">
          <span className="pill"><Zap size={15} /> STRATEGY ENGINE</span>
          <h1>RSI + EMA Cross 9/20 + Order Block 🔥</h1>
          <p>
            Sinyal sekarang bukan candle random lagi. Backend membaca candle MT5, menghitung RSI, EMA 9/20, dan area order block.
          </p>
          <div className="actions">
            <button onClick={loadAll} disabled={loading}>
              <RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}
            </button>
            <a href="/api/signal" target="_blank">Open Signal JSON</a>
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

      <section className="strategyGrid">
        <StrategyCard title="RSI 14" value={signal?.strategy?.rsi ?? "-"} desc="55-72 BUY bias, 28-45 SELL bias" />
        <StrategyCard title="EMA 9" value={signal?.strategy?.ema9 ?? "-"} desc="Fast moving average" />
        <StrategyCard title="EMA 20" value={signal?.strategy?.ema20 ?? "-"} desc="Slow moving average" />
        <StrategyCard title="EMA Cross" value={signal?.strategy?.emaCross ?? "-"} desc="Cross dan trend filter" />
        <StrategyCard title="Buy Score" value={signal?.strategy?.buyScore ?? "-"} desc="Skor konfirmasi BUY" />
        <StrategyCard title="Sell Score" value={signal?.strategy?.sellScore ?? "-"} desc="Skor konfirmasi SELL" />
      </section>

      <section className="obGrid">
        <OrderBlock title="Bullish Order Block" data={signal?.strategy?.orderBlock?.bullish} />
        <OrderBlock title="Bearish Order Block" data={signal?.strategy?.orderBlock?.bearish} />
      </section>

      <section className="chartWrap card">
        <div className="sectionTitle">
          <div>
            <h3>TradingView Lightweight Candlestick</h3>
            <span>{market?.symbol || "XAUUSD"} · {market?.timeframe || "M1"} · Bid {market?.bid || "-"}</span>
          </div>
          <div className="legend">
            <b><i className="bullDot"></i> Bullish</b>
            <b><i className="bearDot"></i> Bearish</b>
            <em><span></span> Auto refresh 5s</em>
          </div>
        </div>

        {tvCandles.length > 0 ? (
          <div className="tvChart" ref={chartBoxRef}></div>
        ) : (
          <div className="empty">{market?.message || "Belum ada candle. Jalankan EA MT5 dulu."}</div>
        )}
      </section>

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}

function candlesToTradingView(candles) {
  const seen = new Set();

  return (candles || [])
    .map((c, index) => {
      const timestamp = parseMt5Time(c.time);
      const key = timestamp || index;

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        time: timestamp || Math.floor(Date.now() / 1000) + index,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close)
      };
    })
    .filter(Boolean)
    .filter((c) =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    );
}

function parseMt5Time(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\./g, "-").replace(" ", "T");
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
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

function StrategyCard({ title, value, desc }) {
  return (
    <div className="strategyCard card">
      <Brain size={18} />
      <small>{title}</small>
      <strong>{value}</strong>
      <span>{desc}</span>
    </div>
  );
}

function OrderBlock({ title, data }) {
  return (
    <div className="obCard card">
      <small>{title}</small>
      {data ? (
        <>
          <strong>{data.low} - {data.high}</strong>
          <span>{data.originTime || "-"}</span>
        </>
      ) : (
        <>
          <strong>-</strong>
          <span>Belum terdeteksi</span>
        </>
      )}
    </div>
  );
}
