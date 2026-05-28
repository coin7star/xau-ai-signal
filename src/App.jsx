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
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);

  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("-");
  const [chartError, setChartError] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const [marketJson, signalJson] = await Promise.all([
        fetch(`/api/market?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/signal?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json())
      ]);

      setMarket(marketJson);
      setSignal(signalJson);
      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setMarket({ ok: false, message: err.message, candles: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const candles = Array.isArray(market?.candles) ? market.candles : [];
  const tvCandles = useMemo(() => candlesToTradingView(candles), [candles]);
  const lastCandle = candles[candles.length - 1];
  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const spread = market?.ask && market?.bid
    ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2)
    : "-";

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth || 900,
        height: 500,
        layout: {
          background: { type: ColorType.Solid, color: "#070b17" },
          textColor: "#cbd5e1"
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.06)" },
          horzLines: { color: "rgba(255,255,255,0.06)" }
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.12)",
          scaleMargins: { top: 0.12, bottom: 0.12 }
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.12)",
          timeVisible: true,
          secondsVisible: false
        }
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

      const resizeObserver = new ResizeObserver(() => {
        if (!chartContainerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth || 900
        });
      });

      resizeObserver.observe(chartContainerRef.current);
      setChartError("");

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      };
    } catch (err) {
      setChartError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current) return;

    try {
      if (tvCandles.length > 0) {
        candleSeriesRef.current.setData(tvCandles);
        chartRef.current.timeScale().fitContent();
        setChartError("");
      }
    } catch (err) {
      setChartError(err.message || String(err));
    }
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
          <span className="pill"><Zap size={15} /> FINAL FIX</span>
          <h1>RSI realtime + candle muncul lagi 🔥</h1>
          <p>
            Chart selalu dimount dari awal, lalu candle MT5 di-push ulang tiap refresh. RSI pakai Wilder style seperti MT5 iRSI.
          </p>
          <div className="actions">
            <button onClick={loadData} disabled={loading}>
              <RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}
            </button>
            <a href="/api/signal" target="_blank" rel="noreferrer">Open Signal JSON</a>
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
        <StrategyCard title="RSI 14" value={signal?.strategy?.rsi ?? "-"} desc="Wilder RSI seperti MT5 iRSI" />
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

        {chartError && <div className="chartError">Chart error: {chartError}</div>}

        <div className="tvChart" ref={chartContainerRef}></div>

        {tvCandles.length === 0 && (
          <div className="chartEmpty">
            Belum ada candle valid. Cek /api/market apakah candles sudah masuk.
          </div>
        )}
      </section>

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}

function candlesToTradingView(candles) {
  if (!Array.isArray(candles)) return [];

  const seen = new Set();

  return candles
    .map((candle, index) => {
      const timestamp = parseMt5Time(candle.time);

      const item = {
        time: timestamp || Math.floor(Date.now() / 1000) + index,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close)
      };

      const key = item.time;
      if (seen.has(key)) return null;
      seen.add(key);

      return item;
    })
    .filter(Boolean)
    .filter((c) =>
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    )
    .sort((a, b) => a.time - b.time);
}

function parseMt5Time(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const normalized = raw.replace(/\./g, "-").replace(" ", "T");
  const ms = Date.parse(normalized);

  if (!Number.isNaN(ms)) {
    return Math.floor(ms / 1000);
  }

  const parts = raw.match(/^(\d{4})[.\-](\d{2})[.\-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!parts) return null;

  const [, y, mo, d, h, mi, s = "00"] = parts;
  return Math.floor(new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime() / 1000);
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
