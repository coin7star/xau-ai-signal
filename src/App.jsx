import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import {
  Activity,
  Bot,
  Database,
  Radio,
  RefreshCcw,
  Shield,
  Sparkles,
  Target,
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
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("-");
  const [chartError, setChartError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const [marketJson, signalJson, aiJson] = await Promise.all([
        fetch(`/api/market?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/signal?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/ai-analysis?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json())
      ]);

      setMarket(marketJson);
      setSignal(signalJson);
      setAiAnalysis(aiJson);
      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setMarket({ ok: false, message: err.message, candles: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, []);

  const candles = Array.isArray(market?.candles) ? market.candles : [];
  const tvCandles = useMemo(() => candlesToTradingView(candles), [candles]);
  const lastCandle = candles[candles.length - 1];

  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const spread = market?.ask && market?.bid ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2) : "-";

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
        priceFormat: { type: "price", precision: 2, minMove: 0.01 }
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      const resizeObserver = new ResizeObserver(() => {
        if (!chartContainerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth || 900 });
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

  const signalTone = isBuy ? "buy" : isSell ? "sell" : "wait";
  const readableSignal = signal?.signal || "WAIT";
  const trendBias = signal?.strategy?.trendBias || "-";
  const smc = signal?.strategy?.smc;

  return (
    <main className="page">
      <header className="nav">
        <div className="brand">
          <div className="logo"><Bot size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>SMC Order Block v2 · AI Analysis</span>
          </div>
        </div>
        <div className="live"><Radio size={14} /> Firebase Live</div>
      </header>

      <section className="hero cleanHero">
        <div className="intro card">
          <span className="pill"><Zap size={15} /> SMC ORDER BLOCK V2</span>
          <h1>Order Block lebih pintar: BOS, status, strength.</h1>
          <p>
            Sistem sekarang cari swing high/low, deteksi Break of Structure, cari origin candle,
            lalu validasi apakah OB masih active, mitigated, atau invalid.
          </p>
          <div className="actions">
            <button onClick={loadData} disabled={loading}>
              <RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}
            </button>
            <a href="/api/ai-analysis" target="_blank" rel="noreferrer">AI JSON</a>
          </div>
        </div>

        <div className={`signalBox card ${signalTone}`}>
          <div className="signalTop">
            <b>{market?.symbol || "XAUUSD"}</b>
            <span>{lastUpdate}</span>
          </div>
          <h2>{readableSignal}</h2>
          <div className="confidence">{signal?.confidence || 0}% confidence</div>
          <p>{signal?.reason || "Menunggu candle MT5..."}</p>

          <div className="tradePlan">
            <div><small>Entry</small><strong>{signal?.entry || "-"}</strong></div>
            <div><small>Stop Loss</small><strong>{signal?.sl || "-"}</strong></div>
            <div><small>Take Profit</small><strong>{signal?.tp || "-"}</strong></div>
          </div>
        </div>
      </section>

      <section className="overview card">
        <div className="overviewItem"><Database size={18} /><small>Data source</small><strong>Firebase RTDB</strong></div>
        <div className="overviewItem"><Activity size={18} /><small>Candle</small><strong>{candles.length} data</strong></div>
        <div className="overviewItem"><Shield size={18} /><small>Spread</small><strong>{spread}</strong></div>
        <div className="overviewItem">{isSell ? <TrendingDown size={18} /> : <TrendingUp size={18} />}<small>Last close</small><strong>{lastCandle?.close || "-"}</strong></div>
      </section>

      <section className="aiPanel card">
        <div className="strategyHeader">
          <div>
            <span className="pill mini"><Sparkles size={14} /> AI MARKET ANALYSIS</span>
            <h3>Analisa AI sinkron</h3>
          </div>
          <div className={`biasBadge ${aiAnalysis?.mode === "ai-live" ? "buy" : "wait"}`}>
            {aiAnalysis?.mode === "ai-live" ? "AI Live" : "Fallback"}
          </div>
        </div>
        <div className="aiText">
          {formatAiText(aiAnalysis?.analysis || "Menunggu analisa AI...")}
        </div>
      </section>

      <section className="strategyPanel card">
        <div className="strategyHeader">
          <div>
            <span className="pill mini"><Target size={14} /> SMC SNAPSHOT</span>
            <h3>Ringkasan struktur market</h3>
          </div>
          <div className={`biasBadge ${signalTone}`}>{trendBias}</div>
        </div>

        <div className="strategyCleanGrid">
          <Metric label="RSI 14" value={signal?.strategy?.rsi ?? "-"} note="Wilder RSI seperti MT5" />
          <Metric label="EMA Cross" value={humanize(signal?.strategy?.emaCross)} note={`EMA9 ${signal?.strategy?.ema9 ?? "-"} · EMA20 ${signal?.strategy?.ema20 ?? "-"}`} />
          <Metric label="Last BOS" value={humanize(smc?.lastBos?.type)} note={`BOS count ${smc?.bosCount ?? 0}`} />
        </div>

        <div className="obV2Grid">
          <ObV2 title="Bullish OB v2" data={signal?.strategy?.orderBlock?.bullish} />
          <ObV2 title="Bearish OB v2" data={signal?.strategy?.orderBlock?.bearish} />
        </div>

        <details className="detailsBox">
          <summary>Lihat detail indikator</summary>
          <div className="detailsGrid">
            <InfoLine label="Buy / Sell Score" value={`${signal?.strategy?.buyScore ?? "-"} / ${signal?.strategy?.sellScore ?? "-"}`} />
            <InfoLine label="SMC Version" value={smc?.version || "-"} />
            <InfoLine label="Last BOS Time" value={smc?.lastBos?.time || "-"} />
            <InfoLine label="Mode" value={signal?.mode || "-"} />
          </div>
        </details>
      </section>

      <section className="chartWrap card">
        <div className="sectionTitle">
          <div>
            <h3>Live Candlestick Chart</h3>
            <span>{market?.symbol || "XAUUSD"} · {market?.timeframe || "M1"} · Bid {market?.bid || "-"}</span>
          </div>
          <div className="legend">
            <b><i className="bullDot"></i> Bullish</b>
            <b><i className="bearDot"></i> Bearish</b>
            <em><span></span> Auto refresh 12s</em>
          </div>
        </div>

        {chartError && <div className="chartError">Chart error: {chartError}</div>}
        <div className="tvChart" ref={chartContainerRef}></div>

        {tvCandles.length === 0 && (
          <div className="chartEmpty">Belum ada candle valid. Cek /api/market apakah candles sudah masuk.</div>
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

      if (seen.has(item.time)) return null;
      seen.add(item.time);

      return item;
    })
    .filter(Boolean)
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);
}

function parseMt5Time(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = raw.replace(/\./g, "-").replace(" ", "T");
  const ms = Date.parse(normalized);
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  const parts = raw.match(/^(\d{4})[.\-](\d{2})[.\-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!parts) return null;
  const [, y, mo, d, h, mi, s = "00"] = parts;
  return Math.floor(new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime() / 1000);
}

function Metric({ label, value, note }) {
  return <div className="metric"><small>{label}</small><strong>{value || "-"}</strong><span>{note}</span></div>;
}

function InfoLine({ label, value }) {
  return <div className="infoLine"><span>{label}</span><strong>{value || "-"}</strong></div>;
}

function ObV2({ title, data }) {
  const tone = data?.status === "active" ? "active" : data?.status === "mitigated" ? "mitigated" : "invalid";
  return (
    <div className={`obV2 ${tone}`}>
      <div>
        <small>{title}</small>
        <strong>{data ? `${data.low} - ${data.high}` : "-"}</strong>
      </div>
      <span>{data?.status || "not found"}</span>
      <p>{data ? `Strength ${data.strength}% · ${data.reason}` : "Belum terdeteksi."}</p>
    </div>
  );
}

function humanize(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

function formatAiText(text) {
  return String(text).split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>);
}
