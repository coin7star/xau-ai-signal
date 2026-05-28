import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Activity, Bot, Database, Radio, RefreshCcw, Shield, Sparkles, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";

export default function App() {
  const chartM1Ref = useRef(null);
  const chartM15Ref = useRef(null);
  const chartM1BoxRef = useRef(null);
  const chartM15BoxRef = useRef(null);
  const seriesM1Ref = useRef(null);
  const seriesM15Ref = useRef(null);

  const ema9M1Ref = useRef(null);
  const ema20M1Ref = useRef(null);
  const ema9M15Ref = useRef(null);
  const ema20M15Ref = useRef(null);

  const obLinesM1Ref = useRef([]);
  const obLinesM15Ref = useRef([]);

  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [callHistory, setCallHistory] = useState({ stats: null, history: [] });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("xau_admin_token") || "");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("-");
  const [chartError, setChartError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const [marketJson, signalJson, aiJson, historyJson] = await Promise.all([
        fetch(`/api/market?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/signal?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/ai-analysis?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/call-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] }))
      ]);
      setMarket(marketJson);
      setSignal(signalJson);
      setAiAnalysis(aiJson);
      setCallHistory(historyJson);
      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setMarket({ ok: false, message: err.message, candles: [], candlesM15: [] });
    } finally {
      setLoading(false);
    }
  }

  async function updateCallResult(id, result) {
    if (!id) return;

    try {
      const res = await fetch("/api/call-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ id, result, token: adminToken })
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Gagal update CALL result");
        return;
      }

      await loadData();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function saveAdminToken(value) {
    setAdminToken(value);
    localStorage.setItem("xau_admin_token", value);
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, []);

  const candlesM1 = Array.isArray(market?.candles) ? market.candles : [];
  const candlesM15 = Array.isArray(market?.candlesM15) ? market.candlesM15 : [];
  const tvM1 = useMemo(() => candlesToTradingView(candlesM1), [candlesM1]);
  const tvM15 = useMemo(() => candlesToTradingView(candlesM15), [candlesM15]);
  const lastCandle = candlesM1[candlesM1.length - 1];

  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const isReady = signal?.callStage === "READY";
  const spread = market?.ask && market?.bid ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2) : "-";

  useEffect(() => {
    initChart("M1");
    initChart("M15");
  }, []);

  useEffect(() => updateChart(seriesM1Ref.current, chartM1Ref.current, tvM1), [tvM1]);
  useEffect(() => updateChart(seriesM15Ref.current, chartM15Ref.current, tvM15), [tvM15]);

  useEffect(() => {
    if (ema9M1Ref.current && ema20M1Ref.current && tvM1.length > 0) {
      ema9M1Ref.current.setData(buildEMAData(tvM1, 9));
      ema20M1Ref.current.setData(buildEMAData(tvM1, 20));
    }
  }, [tvM1]);

  useEffect(() => {
    if (ema9M15Ref.current && ema20M15Ref.current && tvM15.length > 0) {
      ema9M15Ref.current.setData(buildEMAData(tvM15, 9));
      ema20M15Ref.current.setData(buildEMAData(tvM15, 20));
    }
  }, [tvM15]);

  useEffect(() => {
    const bullish = getFreshOb(signal?.strategy?.orderBlock?.bullish);
    const bearish = getFreshOb(signal?.strategy?.orderBlock?.bearish);

    if (seriesM1Ref.current) {
      addObLines(seriesM1Ref.current, obLinesM1Ref, bullish, bearish);
    }

    if (seriesM15Ref.current) {
      addObLines(seriesM15Ref.current, obLinesM15Ref, bullish, bearish);
    }
  }, [signal]);

  function initChart(type) {
    const boxRef = type === "M1" ? chartM1BoxRef : chartM15BoxRef;
    const chartRef = type === "M1" ? chartM1Ref : chartM15Ref;
    const seriesRef = type === "M1" ? seriesM1Ref : seriesM15Ref;
    if (!boxRef.current || chartRef.current) return;

    try {
      const chart = createChart(boxRef.current, {
        width: boxRef.current.clientWidth || 900,
        height: type === "M1" ? 500 : 420,
        layout: { background: { type: ColorType.Solid, color: "#070b17" }, textColor: "#cbd5e1" },
        grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.12)", scaleMargins: { top: 0.12, bottom: 0.12 } },
        timeScale: { borderColor: "rgba(255,255,255,0.12)", timeVisible: true, secondsVisible: false }
      });
      const series = chart.addCandlestickSeries({
        upColor: "#19f28f", downColor: "#ff4d6d", borderUpColor: "#19f28f", borderDownColor: "#ff4d6d",
        wickUpColor: "#77ffd0", wickDownColor: "#ff9aac", priceFormat: { type: "price", precision: 2, minMove: 0.01 }
      });

      const ema9Series = chart.addLineSeries({
        color: "#facc15",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
      });

      const ema20Series = chart.addLineSeries({
        color: "#60a5fa",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
      });

      chartRef.current = chart;
      seriesRef.current = series;

      if (type === "M1") {
        ema9M1Ref.current = ema9Series;
        ema20M1Ref.current = ema20Series;
      } else {
        ema9M15Ref.current = ema9Series;
        ema20M15Ref.current = ema20Series;
      }
      const resizeObserver = new ResizeObserver(() => {
        if (!boxRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({ width: boxRef.current.clientWidth || 900 });
      });
      resizeObserver.observe(boxRef.current);
      setChartError("");
    } catch (err) {
      setChartError(err.message || String(err));
    }
  }

  function updateChart(series, chart, data) {
    if (!series || !chart) return;
    try {
      if (data.length > 0) {
        series.setData(data);
        chart.timeScale().fitContent();
        setChartError("");
      }
    } catch (err) {
      setChartError(err.message || String(err));
    }
  }

  const signalTone = isBuy ? "buy" : isSell ? "sell" : isReady ? "ready" : "wait";
  const readableSignal = signal?.signalLabel || signal?.signal || "WAIT";
  const trendBias = signal?.strategy?.trendBias || "-";
  const smc = signal?.strategy?.smc;
  const confirmation = signal?.strategy?.confirmation || {};
  const freshBullOb = getFreshOb(signal?.strategy?.orderBlock?.bullish);
  const freshBearOb = getFreshOb(signal?.strategy?.orderBlock?.bearish);
  const obCardValue = formatObCardValue(freshBullOb, freshBearOb);
  const obCardNote = formatObCardNote(freshBullOb, freshBearOb, smc);
  const probability = signal?.strategy?.probability || {
    score: signal?.confidence || 0,
    label: signal?.confidence >= 80 ? "HIGH" : signal?.confidence >= 65 ? "MEDIUM" : "LOW",
    checklist: []
  };
  const scalping = signal?.strategy?.scalping || {
    label: "SCALP WAIT",
    confidence: 0,
    action: "WAIT",
    entry: "-",
    sl: "-",
    tp: "-",
    reason: "Menunggu data M1."
  };
  const historyStats = callHistory?.stats || {};
  const telegramStatus = signal?.telegram?.ok ? "Telegram OK" : signal?.telegram?.skipped || "Telegram standby";

  return (
    <main className="page">
      <header className="nav">
        <div className="brand">
          <div className="logo"><Bot size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>Telegram Webhook Commands · RSI · MFI · EMA · OB M15</span>
          </div>
        </div>
        <div className="live"><Radio size={14} /> {telegramStatus}</div>
      </header>

      <section className="hero cleanHero">
        <div className="intro card">
          <span className="pill"><Zap size={15} /> BOT COMMAND READY</span>
          <h1>/signal, /status, /help sekarang bisa jalan.</h1>
          <p>
            Setelah webhook diset, Telegram bot bisa membalas command langsung dari Firebase dan signal terbaru.
          </p>
          <div className="actions">
            <button onClick={loadData} disabled={loading}><RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}</button>
            <a href="/api/telegram-set-webhook" target="_blank" rel="noreferrer">Set Webhook</a>
          </div>
        </div>

        <div className={`signalBox card ${signalTone}`}>
          <div className="signalTop"><b>{market?.symbol || "XAUUSD"}</b><span>{lastUpdate}</span></div>
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
        <div className="overviewItem"><Activity size={18} /><small>M1 Candle</small><strong>{candlesM1.length} data</strong></div>
        <div className="overviewItem"><Shield size={18} /><small>M15 Candle</small><strong>{candlesM15.length} data</strong></div>
        <div className="overviewItem">{isSell ? <TrendingDown size={18} /> : <TrendingUp size={18} />}<small>Last close</small><strong>{lastCandle?.close || "-"}</strong></div>
      </section>

      <section className="aiPanel card">
        <div className="strategyHeader">
          <div><span className="pill mini"><Sparkles size={14} /> AI MARKET ANALYSIS</span><h3>Analisa AI sinkron</h3></div>
          <div className={`biasBadge ${aiAnalysis?.mode === "ai-live" ? "buy" : "wait"}`}>{aiAnalysis?.mode === "ai-live" ? "AI Live" : "Fallback"}</div>
        </div>
        <div className="aiText">{formatAiText(aiAnalysis?.analysis || "Menunggu analisa AI...")}</div>
      </section>

      <section className="strategyPanel card">
        <div className="strategyHeader">
          <div><span className="pill mini"><Target size={14} /> CONFIRMATION SNAPSHOT</span><h3>RSI + MFI + EMA + OB M15</h3></div>
          <div className={`biasBadge ${signalTone}`}>{trendBias}</div>
        </div>
        <div className="strategyCleanGrid four">
          <Metric label="RSI 14" value={signal?.strategy?.rsi ?? "-"} note={`BUY ${confirmation.rsiBuyOk ? "OK" : "-"} · SELL ${confirmation.rsiSellOk ? "OK" : "-"}`} />
          <Metric label="MFI 14" value={signal?.strategy?.mfi ?? "-"} note={`BUY ${confirmation.mfiBuyOk ? "OK" : "-"} · SELL ${confirmation.mfiSellOk ? "OK" : "-"}`} />
          <Metric label="EMA Cross" value={humanize(signal?.strategy?.emaCross)} note={signal?.strategy?.crossAlert?.message || "-"} />
          <Metric label="Fresh OB M15" value={obCardValue} note={obCardNote} />
          <Metric label="Probability" value={`${probability.score || 0}% · ${probability.label || "LOW"}`} note={(probability.checklist || []).join(" · ") || "Menunggu score"} />
          <Metric label="M1 Scalp" value={`${scalping.label || "SCALP WAIT"}`} note={`${scalping.confidence || 0}% · ${scalping.action || "WAIT"}`} />
        </div>
      </section>



      <section className={`scalpPanel card ${String(scalping.action || "WAIT").toLowerCase()}`}>
        <div className="strategyHeader">
          <div>
            <span className="pill mini"><Zap size={14} /> M1 SCALPING MODE</span>
            <h3>{scalping.label || "SCALP WAIT"}</h3>
          </div>
          <div className={`biasBadge ${scalping.action === "SCALP_BUY" ? "buy" : scalping.action === "SCALP_SELL" ? "sell" : "wait"}`}>
            {scalping.confidence || 0}% scalp
          </div>
        </div>

        <div className="scalpGrid">
          <Metric label="Scalp Entry" value={scalping.entry || "-"} note="Harga acuan kalau status SCALP valid" />
          <Metric label="Scalp SL" value={scalping.sl || "-"} note="Stop loss cepat dari ATR + swing M1" />
          <Metric label="Scalp TP" value={scalping.tp || "-"} note="Target cepat RR 1 : 1.25" />
          <Metric label="EMA 5/13" value={`${scalping.ema5 || "-"} / ${scalping.ema13 || "-"}`} note="EMA cepat untuk baca momentum M1" />
          <Metric label="Scalp Strength" value={`${scalping.score || 0}/100`} note="Minimal 58/100 untuk SCALP BUY/SELL" />
        </div>

        <p className="scalpReason">{scalping.reason}</p>
        <p className="scalpWarning">Scalping ini sinyal cepat untuk pantauan. CALL utama tetap pakai RSI + MFI + EMA 9/20 + Fresh OB M15.</p>
      </section>

      <section className="historyPanel card">
        <div className="sectionTitle">
          <div>
            <h3>CALL History & Manual Win/Loss</h3>
            <span>Auto-save saat CALL valid. Kamu bisa tandai hasil manual untuk track performa.</span>
          </div>
          <div className="historyStats">
            <b>Total {historyStats.total || 0}</b>
            <b>Open {historyStats.open || 0}</b>
            <b>Win {historyStats.wins || 0}</b>
            <b>Loss {historyStats.losses || 0}</b>
            <b>BE {historyStats.be || 0}</b>
            <em>WR {historyStats.winRate || 0}%</em>
          </div>
        </div>

        <div className="adminTokenBox">
          <span>Admin token untuk update Win/Loss</span>
          <input
            value={adminToken}
            onChange={(event) => saveAdminToken(event.target.value)}
            placeholder="Isi ADMIN_ACTION_TOKEN Cloudflare"
            type="password"
          />
        </div>

        <div className="historyTable">
          <div className="historyHead">
            <span>Time</span>
            <span>Signal</span>
            <span>Entry</span>
            <span>SL / TP</span>
            <span>Prob</span>
            <span>Result</span>
            <span>Action</span>
          </div>

          {(callHistory?.history || []).slice(0, 12).map((item) => (
            <div className="historyRow" key={item.id}>
              <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
              <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
              <span>{item.entry}</span>
              <span>{item.sl || "-"} / {item.tp || "-"}</span>
              <span>{item.probability?.score ?? item.confidence ?? "-"}%</span>
              <span className={`resultBadge ${(item.result || item.status || "OPEN").toLowerCase()}`}>
                {item.result || item.status || "OPEN"}
              </span>
              <div className="historyActions">
                <button type="button" onClick={() => updateCallResult(item.id, "WIN")}>WIN</button>
                <button type="button" onClick={() => updateCallResult(item.id, "LOSS")}>LOSS</button>
                <button type="button" onClick={() => updateCallResult(item.id, "BE")}>BE</button>
                <button type="button" onClick={() => updateCallResult(item.id, "OPEN")}>OPEN</button>
              </div>
            </div>
          ))}

          {(!callHistory?.history || callHistory.history.length === 0) && (
            <div className="emptyHistory">Belum ada CALL valid. History otomatis muncul saat signal BUY/SELL CALL.</div>
          )}
        </div>
      </section>

      <section className="chartWrap card">
        <div className="sectionTitle">
          <div><h3>Live M1 Candlestick Chart</h3><span>{market?.symbol || "XAUUSD"} · M1 · Bid {market?.bid || "-"} · Spread {spread}</span></div>
          <div className="legend">
            <b><i className="bullDot"></i> Bullish</b>
            <b><i className="bearDot"></i> Bearish</b>
            <b><i className="ema9Dot"></i> EMA 9</b>
            <b><i className="ema20Dot"></i> EMA 20</b>
            <b><i className="obBullDot"></i> Bull OB</b>
            <b><i className="obBearDot"></i> Bear OB</b>
            <em><span></span> Auto refresh 12s</em>
          </div>
        </div>
        {chartError && <div className="chartError">Chart error: {chartError}</div>}
        <div className="tvChart" ref={chartM1BoxRef}></div>
      </section>

      <section className="chartWrap card">
        <div className="sectionTitle">
          <div><h3>Live M15 Order Block Chart</h3><span>{market?.symbol || "XAUUSD"} · M15 · OB validation chart</span></div>
          <div className="legend">
            <b><i className="bullDot"></i> Bullish</b>
            <b><i className="bearDot"></i> Bearish</b>
            <b><i className="ema9Dot"></i> EMA 9</b>
            <b><i className="ema20Dot"></i> EMA 20</b>
            <b><i className="obBullDot"></i> Bull OB</b>
            <b><i className="obBearDot"></i> Bear OB</b>
            <em><span></span> Fresh OB M15</em>
          </div>
        </div>
        <div className="tvChart small" ref={chartM15BoxRef}></div>
      </section>

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}

function candlesToTradingView(candles) {
  if (!Array.isArray(candles)) return [];
  const seen = new Set();
  return candles.map((candle, index) => {
    const timestamp = parseMt5Time(candle.time);
    const item = { time: timestamp || Math.floor(Date.now() / 1000) + index, open: Number(candle.open), high: Number(candle.high), low: Number(candle.low), close: Number(candle.close) };
    if (seen.has(item.time)) return null;
    seen.add(item.time);
    return item;
  }).filter(Boolean).filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close)).sort((a, b) => a.time - b.time);
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


function getFreshOb(ob) {
  if (!ob) return null;
  if (ob.invalidated || ob.status === "invalid") return null;

  // Tampilkan hanya OB fresh/active.
  // Mitigated disembunyikan, tapi mitigated sekarang dihitung lebih fair:
  // harus retrace minimal 50% zona OB setelah BOS.
  if (ob.status !== "active") return null;
  if (ob.mitigated) return null;

  const low = Number(ob.low);
  const high = Number(ob.high);

  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;

  return ob;
}



function buildEMAData(candles, period) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const k = 2 / (period + 1);
  let ema = Number(candles[0].close);

  return candles
    .map((candle, index) => {
      const close = Number(candle.close);

      if (!Number.isFinite(close) || !Number.isFinite(candle.time)) return null;

      if (index === 0) {
        ema = close;
      } else {
        ema = close * k + ema * (1 - k);
      }

      return {
        time: candle.time,
        value: Number(ema.toFixed(2))
      };
    })
    .filter(Boolean);
}

function clearObLines(linesRef) {
  if (!linesRef.current) return;

  linesRef.current.forEach(({ series, line }) => {
    try {
      series.removePriceLine(line);
    } catch {}
  });

  linesRef.current = [];
}

function addObLines(series, linesRef, bullish, bearish) {
  clearObLines(linesRef);

  const newLines = [];

  if (bullish && Number.isFinite(Number(bullish.low)) && Number.isFinite(Number(bullish.high))) {
    const bullLow = series.createPriceLine({
      price: Number(bullish.low),
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "M15 Bull OB Low"
    });

    const bullHigh = series.createPriceLine({
      price: Number(bullish.high),
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "M15 Bull OB High"
    });

    newLines.push({ series, line: bullLow }, { series, line: bullHigh });
  }

  if (bearish && Number.isFinite(Number(bearish.low)) && Number.isFinite(Number(bearish.high))) {
    const bearLow = series.createPriceLine({
      price: Number(bearish.low),
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "M15 Bear OB Low"
    });

    const bearHigh = series.createPriceLine({
      price: Number(bearish.high),
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "M15 Bear OB High"
    });

    newLines.push({ series, line: bearLow }, { series, line: bearHigh });
  }

  linesRef.current = newLines;
}

function formatObCardValue(bullish, bearish) {
  if (bullish) return `BUY ${Number(bullish.low).toFixed(2)} - ${Number(bullish.high).toFixed(2)}`;
  if (bearish) return `SELL ${Number(bearish.low).toFixed(2)} - ${Number(bearish.high).toFixed(2)}`;
  return "Tidak ada fresh OB";
}

function formatObCardNote(bullish, bearish, smc) {
  const ob = bullish || bearish;

  if (!ob) {
    return `Last: ${humanize(smc?.lastBos?.type)}`;
  }

  const method = ob.method ? humanize(ob.method) : "SMC";
  const strength = ob.strength ? `strength ${ob.strength}%` : "fresh";
  const origin = ob.originTime ? `origin ${formatShortTime(ob.originTime)}` : "";

  return `${ob.direction?.toUpperCase?.() || "OB"} · ${method} · ${strength}${origin ? " · " + origin : ""}`;
}

function formatShortTime(value) {
  if (!value) return "-";
  const raw = String(value);
  const parts = raw.split(" ");
  return parts[1] || raw;
}


function formatHistoryTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(value);
  }
}

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong title={String(value || "-")}>{value || "-"}</strong>
      <span>{note}</span>
    </div>
  );
}
function humanize(value) { if (!value) return "-"; return String(value).replaceAll("_", " "); }
function formatAiText(text) { return String(text).split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>); }
