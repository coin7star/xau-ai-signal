import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Activity, Bot, Copy, Database, Lock, LogOut, Radio, RefreshCcw, Settings, Shield, Sparkles, Target, TrendingDown, TrendingUp, User, Zap } from "lucide-react";
import { ensureUserProfile, getUserProfile, hasFirebaseClientConfig, isPremiumProfile, listenAuth, loginWithEmail, loginWithGoogle, logout, refreshCurrentUser, registerWithEmail, sendVerificationEmail } from "./firebaseClient";

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
  const srLinesM1Ref = useRef([]);

  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [callHistory, setCallHistory] = useState({ stats: null, history: [] });
  const [scalpHistory, setScalpHistory] = useState({ stats: null, history: [] });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("xau_admin_token") || "");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("-");
  const [chartError, setChartError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [telegramConnect, setTelegramConnect] = useState(null);

  async function loadData({ includeChart = false, includeHistory = false, includeScalpHistory = false } = {}) {
    try {
      setLoading(true);

      const requests = [
        fetch(`/api/market?mode=${includeChart ? "chart&m1=90&m15=60" : "lite"}&ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/signal?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/ai-analysis?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json())
      ];

      if (includeHistory) {
        requests.push(fetch(`/api/call-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] })));
      }

      if (includeScalpHistory) {
        requests.push(fetch(`/api/scalp-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] })));
      }

      const [marketJson, signalJson, aiJson, historyJson, scalpHistoryJson] = await Promise.all(requests);

      setMarket((previous) => {
        if (includeChart) return marketJson;
        return {
          ...(previous || {}),
          ...marketJson,
          candles: previous?.candles || [],
          candlesM15: previous?.candlesM15 || []
        };
      });

      setSignal(signalJson);
      setAiAnalysis(aiJson);

      if (includeHistory && historyJson) {
        setCallHistory(historyJson);
      }

      if (includeScalpHistory && scalpHistoryJson) {
        setScalpHistory(scalpHistoryJson);
      }

      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      setMarket((previous) => previous || { ok: false, message: err.message, candles: [], candlesM15: [] });
    } finally {
      setLoading(false);
    }
  }

  async function loadLiteData() {
    return loadData({ includeChart: false, includeHistory: false });
  }

  async function loadChartData() {
    return loadData({ includeChart: true, includeHistory: false });
  }

  async function reloadChartsNow() {
    await loadChartData();

    setTimeout(() => {
      initChart("M1");
      initChart("M15");
      updateChart(seriesM1Ref.current, chartM1Ref.current, tvM1);
      updateChart(seriesM15Ref.current, chartM15Ref.current, tvM15);
    }, 120);
  }

  async function loadHistoryData() {
    return loadData({ includeChart: false, includeHistory: true });
  }


  async function loadTelegramConnectStatus() {
    if (!authUser?.uid) return;

    try {
      const res = await fetch(`/api/telegram-connect-code?uid=${encodeURIComponent(authUser.uid)}&ts=${Date.now()}`, {
        cache: "no-store"
      });
      const json = await res.json();
      if (json.ok) setTelegramConnect(json);
    } catch {
      // silent
    }
  }

  async function loadScalpHistoryData() {
    return loadData({ includeChart: false, includeScalpHistory: true });
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

      await loadHistoryData();
    } catch (err) {
      alert(err.message || String(err));
    }
  }


  async function updateScalpResult(id, result) {
    if (!id) return;

    try {
      const res = await fetch("/api/scalp-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ id, result, token: adminToken })
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Gagal update SCALP result");
        return;
      }

      await loadScalpHistoryData();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function saveAdminToken(value) {
    setAdminToken(value);
    localStorage.setItem("xau_admin_token", value);
  }

  useEffect(() => {
    const unsubscribe = listenAuth(async (user) => {
      setAuthLoading(true);

      try {
        if (!user) {
          setAuthUser(null);
          setAuthProfile(null);
          return;
        }

        setAuthUser(user);
        const profile = await ensureUserProfile(user);
        const freshProfile = await getUserProfile(user.uid);
        setAuthProfile(freshProfile || profile);
      } finally {
        setAuthLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUser || !isPremiumProfile(authProfile)) return;

    loadData({ includeChart: true, includeHistory: true, includeScalpHistory: true });
    loadTelegramConnectStatus();

    const liteInterval = setInterval(loadLiteData, 12000);
    const chartInterval = setInterval(loadChartData, 45000);
    const historyInterval = setInterval(loadHistoryData, 60000);
    const scalpHistoryInterval = setInterval(loadScalpHistoryData, 90000);

    return () => {
      clearInterval(liteInterval);
      clearInterval(chartInterval);
      clearInterval(historyInterval);
      clearInterval(scalpHistoryInterval);
    };
  }, [authUser, authProfile?.role, authProfile?.premiumUntil]);

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
    if (!authUser || !isPremiumProfile(authProfile)) return;

    const frame = requestAnimationFrame(() => {
      initChart("M1");
      initChart("M15");

      setTimeout(() => {
        updateChart(seriesM1Ref.current, chartM1Ref.current, tvM1);
        updateChart(seriesM15Ref.current, chartM15Ref.current, tvM15);

        if (ema9M1Ref.current && ema20M1Ref.current && tvM1.length > 0) {
          ema9M1Ref.current.setData(buildEMAData(tvM1, 9));
          ema20M1Ref.current.setData(buildEMAData(tvM1, 20));
        }

        if (ema9M15Ref.current && ema20M15Ref.current && tvM15.length > 0) {
          ema9M15Ref.current.setData(buildEMAData(tvM15, 9));
          ema20M15Ref.current.setData(buildEMAData(tvM15, 20));
        }
      }, 0);
    });

    return () => cancelAnimationFrame(frame);
  }, [authUser, authProfile?.role, authProfile?.premiumUntil, tvM1, tvM15]);

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

  useEffect(() => {
    if (seriesM1Ref.current) {
      addStructureLines(seriesM1Ref.current, srLinesM1Ref, signal?.strategy?.scalping);
    }
  }, [
    signal?.strategy?.scalping?.support,
    signal?.strategy?.scalping?.resistance,
    signal?.strategy?.scalping?.supportTouches,
    signal?.strategy?.scalping?.resistanceTouches
  ]);

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
  const scalpStats = scalpHistory?.stats || {};
  const telegramStatus = signal?.telegram?.ok ? "Telegram OK" : signal?.telegram?.skipped || "Telegram standby";
  const premiumActive = isPremiumProfile(authProfile);
  const roleLabel = authProfile?.role?.toUpperCase?.() || "FREE";
  const isAdmin = authProfile?.role === "admin";
  const premiumInfo = getPremiumInfo(authProfile);
  const emailVerified = Boolean(authUser?.emailVerified || authProfile?.emailVerified);

  if (authLoading) {
    return (
      <main className="page authPage">
        <section className="authCard card">
          <div className="logo big"><Shield size={28} /></div>
          <h1>Loading XAU AI...</h1>
          <p>Sedang cek login dan akses premium.</p>
        </section>
      </main>
    );
  }

  if (!hasFirebaseClientConfig) {
    return (
      <main className="page authPage">
        <section className="authCard card">
          <div className="logo big"><Shield size={28} /></div>
          <h1>Firebase Auth belum diset</h1>
          <p>Isi ENV VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL, VITE_FIREBASE_PROJECT_ID, dan VITE_FIREBASE_APP_ID di Cloudflare Pages.</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  if (!emailVerified) {
    return <VerifyEmailScreen user={authUser} profile={authProfile} onLogout={logout} onVerified={async () => {
      const freshUser = await refreshCurrentUser();
      if (freshUser) {
        setAuthUser({ ...freshUser });
        const freshProfile = await getUserProfile(freshUser.uid);
        setAuthProfile(freshProfile);
      }
    }} />;
  }

  if (!premiumActive) {
    return <PaywallScreen user={authUser} profile={authProfile} onLogout={logout} />;
  }

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
        <div className="navActions">
          <div className="live"><Radio size={14} /> {telegramStatus}</div>
          <div className="accountBadge"><User size={15} /> {roleLabel}</div>
          <div className={`premiumExpiryBadge ${premiumInfo.expired ? "expired" : ""}`}>
            <Shield size={15} /> {premiumInfo.label}
          </div>
          {isAdmin && (
            <button className="navBtn" type="button" onClick={() => setShowAdminPanel((value) => !value)}>
              <Settings size={16} /> Admin
            </button>
          )}
          <button className="navBtn danger" type="button" onClick={logout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <TelegramConnectPanel
        user={authUser}
        profile={authProfile}
        telegramConnect={telegramConnect}
        onRefresh={loadTelegramConnectStatus}
      />


      {isAdmin && showAdminPanel && (
        <AdminPanel adminToken={adminToken} setAdminToken={setAdminToken} />
      )}

      <section className="hero cleanHero">
        <div className="intro card">
          <span className="pill"><Zap size={15} /> BOT COMMAND READY</span>
          <h1>/signal, /status, /help sekarang bisa jalan.</h1>
          <p>
            Setelah webhook diset, Telegram bot bisa membalas command langsung dari Firebase dan signal terbaru.
          </p>
          <div className="actions">
            <button onClick={() => loadData({ includeChart: true, includeHistory: true, includeScalpHistory: true })} disabled={loading}><RefreshCcw size={16} /> {loading ? "Loading..." : "Refresh"}</button>
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
        <div className="overviewItem"><Activity size={18} /><small>M1 Candle</small><strong>{candlesM1.length || market?.m1Count || 0} data</strong></div>
        <div className="overviewItem"><Shield size={18} /><small>M15 Candle</small><strong>{candlesM15.length || market?.m15Count || 0} data</strong></div>
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
            <span className="pill mini"><Zap size={14} /> M1 SR + EMA SCALP</span>
            <h3>{scalping.label || "SCALP WAIT"}</h3>
          </div>
          <div className={`biasBadge ${scalping.action === "SCALP_BUY" ? "buy" : scalping.action === "SCALP_SELL" ? "sell" : "wait"}`}>
            {scalping.confidence || 0}% scalp
          </div>
        </div>

        <div className="scalpGrid">
          <Metric label="Scalp Entry" value={scalping.entry || "-"} note="Area acuan kalau scalp sudah valid" />
          <Metric label="Scalp SL" value={scalping.sl || "-"} note="SL dari candle touch S/R + 1.5 ATR" />
          <Metric label="Scalp TP" value={scalping.tp || "-"} note="Target cepat RR 1 : 1.25" />
          <Metric label="EMA 5/13" value={`${scalping.ema5 || "-"} / ${scalping.ema13 || "-"}`} note="EMA cepat buat baca gas/rem M1" />
          <Metric label="Scalp Strength" value={`${scalping.score || 0}/100`} note="Minimal 58/100 untuk SCALP BUY/SELL" />
        </div>

        <p className="scalpReason">{scalping.reason}</p>
        <p className="scalpWarning">Mode scalp baru pakai struktur M1: buy di last swing low M1 + bullish engulfing, sell di last swing high M1 + bearish engulfing. CALL utama tetap lebih saklek.</p>
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


      <section className="historyPanel card scalpHistoryPanel">
        <div className="sectionTitle">
          <div>
            <h3>SCALP M1 Valid History</h3>
            <span>Cuma SCALP BUY/SELL valid yang disimpan. SCALP WAIT tidak masuk biar Firebase tetap hemat.</span>
          </div>
          <div className="historyStats">
            <b>Total {scalpStats.total || 0}</b>
            <b>Open {scalpStats.open || 0}</b>
            <b>Win {scalpStats.wins || 0}</b>
            <b>Loss {scalpStats.losses || 0}</b>
            <b>BE {scalpStats.be || 0}</b>
            <em>WR {scalpStats.winRate || 0}%</em>
          </div>
        </div>

        <div className="historyTable">
          <div className="historyHead">
            <span>Time</span>
            <span>Signal</span>
            <span>Entry</span>
            <span>SL / TP</span>
            <span>Score</span>
            <span>Result</span>
            <span>Action</span>
          </div>

          {(scalpHistory?.history || []).slice(0, 10).map((item) => (
            <div className="historyRow" key={item.id}>
              <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
              <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
              <span>{item.entry}</span>
              <span>{item.sl || "-"} / {item.tp || "-"}</span>
              <span>{item.score ?? item.confidence ?? "-"}%</span>
              <span className={`resultBadge ${(item.result || item.status || "OPEN").toLowerCase()}`}>
                {item.result || item.status || "OPEN"}
              </span>
              <div className="historyActions">
                <button type="button" onClick={() => updateScalpResult(item.id, "WIN")}>WIN</button>
                <button type="button" onClick={() => updateScalpResult(item.id, "LOSS")}>LOSS</button>
                <button type="button" onClick={() => updateScalpResult(item.id, "BE")}>BE</button>
                <button type="button" onClick={() => updateScalpResult(item.id, "OPEN")}>OPEN</button>
              </div>
            </div>
          ))}

          {(!scalpHistory?.history || scalpHistory.history.length === 0) && (
            <div className="emptyHistory">Belum ada SCALP BUY/SELL valid. History akan muncul otomatis saat scalp mode valid.</div>
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
            <b><i className="supportDot"></i> M1 Support</b>
            <b><i className="resistDot"></i> M1 Resistance</b>
            <em><span></span> Lite 12s · Chart 45s</em>
          </div>
        </div>
        {chartError && <div className="chartError">Chart error: {chartError}</div>}
        <div className="tvChart" ref={chartM1BoxRef}>
          {tvM1.length === 0 && <div className="chartEmpty">Menunggu candle M1 dari MT5 / Firebase...</div>}
        </div>
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
        <div className="tvChart small" ref={chartM15BoxRef}>
          {tvM15.length === 0 && <div className="chartEmpty">Menunggu candle M15 dari MT5 / Firebase...</div>}
        </div>
      </section>

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}





function formatPremiumUntil(user) {
  if (!user?.premiumUntil) return "-";

  const expiry = new Date(user.premiumUntil);
  const diffMs = expiry.getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dateText = expiry.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  if (user.role === "admin") return `Admin · ${dateText}`;
  if (diffMs <= 0) return `Expired · ${dateText}`;

  return `${dateText} · ${daysLeft} hari`;
}


function getPremiumInfo(profile) {
  if (!profile) {
    return {
      label: "FREE",
      detail: "Belum ada akses premium",
      dateText: "-",
      expired: true
    };
  }

  if (profile.role === "admin") {
    return {
      label: "ADMIN ACCESS",
      detail: "Akses admin aktif tanpa batas normal",
      dateText: "Lifetime admin",
      expired: false
    };
  }

  const until = profile.premiumUntil || profile.expiredAt || null;

  if (profile.role !== "premium") {
    return {
      label: "FREE",
      detail: "Belum ada akses premium",
      dateText: "-",
      expired: true
    };
  }

  if (!until) {
    return {
      label: "PREMIUM EXPIRED",
      detail: "Tanggal expired belum diset",
      dateText: "-",
      expired: true
    };
  }

  const expiry = new Date(until);
  const diffMs = expiry.getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dateText = expiry.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  if (diffMs <= 0) {
    return {
      label: "PREMIUM EXPIRED",
      detail: `Paket expired pada ${dateText}`,
      dateText,
      expired: true
    };
  }

  return {
    label: daysLeft <= 1 ? "Sisa 1 hari" : `Sisa ${daysLeft} hari`,
    detail: `Premium aktif sampai ${dateText}`,
    dateText,
    expired: false
  };
}



function TelegramConnectPanel({ user, profile, telegramConnect, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const connected = Boolean(telegramConnect?.telegramConnected);
  const canConnect = profile?.role === "premium" || profile?.role === "admin";
  const commandText = telegramConnect?.telegramCode ? `/connect ${telegramConnect.telegramCode}` : "";
  const displayCommand = commandText || "/connect XAU-123456";

  async function generateCode() {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/telegram-connect-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user?.uid })
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Gagal generate kode Telegram.");
        return;
      }

      const command = json.instruction || `/connect ${json.code}`;
      setMessage(`Kode baru dibuat. Kode lama otomatis invalid. Tap Copy Command lalu paste ke bot Telegram: ${command}`);
      await onRefresh();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCommand() {
    if (!commandText) {
      setMessage("Generate kode dulu, baru command bisa dicopy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(commandText);
      setMessage(`Command berhasil dicopy: ${commandText}`);
    } catch {
      setMessage(`Copy manual command ini: ${commandText}`);
    }
  }

  async function disconnectTelegram() {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/telegram-disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user?.uid })
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Gagal disconnect Telegram.");
        return;
      }

      setMessage("Telegram disconnected.");
      await onRefresh();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canConnect) return null;

  return (
    <section className="telegramConnectPanel card">
      <div className="telegramConnectHeader">
        <div>
          <span className="pill mini"><Bot size={14} /> TELEGRAM ALERT</span>
          <h3>Connect Telegram Premium</h3>
          <p>Hubungkan akun dashboard ini ke bot Telegram supaya nanti alert premium bisa masuk ke chat kamu.</p>
        </div>
        <div className={`telegramStatusBadge ${connected ? "connected" : ""}`}>
          {connected ? "Connected" : "Not Connected"}
        </div>
      </div>

      <div className="telegramSecurityWarning">
        <b>⚠️ Security Note</b>
        <span>Jangan share kode connect ke siapa pun. Siapa pun yang memakai kode ini bisa menghubungkan Telegram ke akun kamu.</span>
        <span>Kode hanya aktif 15 menit, sekali pakai, dan kode lama otomatis invalid kalau kamu generate kode baru.</span>
      </div>

      <div className="telegramConnectSteps">
        <b>Cara connect:</b>
        <span>1. Klik <b>Generate Connect Code</b>.</span>
        <span>2. Klik <b>Copy Command</b>.</span>
        <span>3. Buka bot Telegram XAU AI.</span>
        <span>4. Paste command, contoh <code>/connect XAU-123456</code>.</span>
        <span>5. Balik ke dashboard lalu klik <b>Refresh Status</b>.</span>
      </div>

      <div className="telegramConnectGrid">
        <div className="telegramConnectBox">
          <span>Status</span>
          <b>{connected ? "Telegram Connected" : "Belum connect"}</b>
          <small>{connected ? `Chat ID: ${telegramConnect?.telegramChatId || "-"}` : "Generate kode lalu kirim command ke bot."}</small>
        </div>

        <div className="telegramConnectBox">
          <span>Connect Code</span>
          <b>{telegramConnect?.telegramCode || "-"}</b>
          <small>{telegramConnect?.telegramCodeExpiresAt ? `Expired: ${formatShortDateTime(telegramConnect.telegramCodeExpiresAt)} · sekali pakai` : "Kode aktif 15 menit dan sekali pakai."}</small>
        </div>

        <div className="telegramConnectBox commandBox">
          <span>Command ke Bot</span>
          <b>{displayCommand}</b>
          <small>{commandText ? "Tap Copy Command, lalu paste ke bot Telegram." : "Generate kode dulu untuk membuat command asli."}</small>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="telegramActions">
        <button type="button" onClick={generateCode} disabled={busy}>
          {busy ? "Loading..." : "Generate Connect Code"}
        </button>
        <button type="button" className="copyBtn" onClick={copyCommand} disabled={busy || !commandText}>
          <Copy size={16} /> Copy Command
        </button>
        <button type="button" onClick={onRefresh} disabled={busy}>
          Refresh Status
        </button>
        {connected && (
          <button type="button" className="danger" onClick={disconnectTelegram} disabled={busy}>
            Disconnect
          </button>
        )}
      </div>

      <p className="miniNote">
        Setelah status Connected, akun premium/admin ini siap menerima auto alert MAIN CALL via Telegram.
      </p>
    </section>
  );
}

function formatShortDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function AdminPanel({ adminToken, setAdminToken }) {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [telegramFilter, setTelegramFilter] = useState("all");
  const [customDays, setCustomDays] = useState(30);
  const [customDate, setCustomDate] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("premium_connected");
  const [expandedUid, setExpandedUid] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 6;
  const stats = useMemo(() => buildAdminStats(users), [users]);

  const filteredUsers = users.filter((user) => {
    const text = `${user.email || ""} ${user.uid || ""} ${user.role || ""}`.toLowerCase();
    const matchSearch = text.includes(query.toLowerCase());
    const role = user.role || "free";
    const premiumActive = isAdminPremiumActive(user);
    const expired = role === "premium" && !premiumActive;

    let matchRole = true;
    if (roleFilter === "free") matchRole = role === "free";
    if (roleFilter === "premium") matchRole = role === "premium" && premiumActive;
    if (roleFilter === "expired") matchRole = expired;
    if (roleFilter === "admin") matchRole = role === "admin";

    let matchTelegram = true;
    if (telegramFilter === "connected") matchTelegram = Boolean(user.telegramConnected && user.telegramChatId);
    if (telegramFilter === "not_connected") matchTelegram = !user.telegramConnected || !user.telegramChatId;

    return matchSearch && matchRole && matchTelegram;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, telegramFilter]);

  useEffect(() => {
    if (adminToken) {
      loadUsers();
    }
  }, []);

  function saveToken(value) {
    setAdminToken(value);
    localStorage.setItem("xau_admin_token", value);
  }

  async function loadUsers() {
    if (!adminToken) {
      setMessage("Isi ADMIN_ACTION_TOKEN dulu.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin-user?token=${encodeURIComponent(adminToken)}&ts=${Date.now()}`, {
        cache: "no-store"
      });
      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Gagal load users");
        return;
      }

      setUsers(json.users || []);
      setMessage(`Loaded ${json.users?.length || 0} user.`);
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(user, role, premiumDays = 0, premiumUntil = "") {
    if (!adminToken) {
      setMessage("Isi ADMIN_ACTION_TOKEN dulu.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const body = { token: adminToken, uid: user.uid, role };

      if (premiumDays > 0) body.premiumDays = premiumDays;
      if (premiumUntil) body.premiumUntil = premiumUntil;

      const res = await fetch("/api/admin-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(body)
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Gagal update user");
        return;
      }

      setMessage(`User ${user.email || user.uid} updated to ${role}.`);
      await loadUsers();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastTelegram() {
    if (!adminToken) {
      setMessage("Isi ADMIN_ACTION_TOKEN dulu.");
      return;
    }

    if (!broadcastText.trim()) {
      setMessage("Isi pesan broadcast dulu.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin-broadcast-telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          token: adminToken,
          text: broadcastText,
          target: broadcastTarget
        })
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Broadcast gagal.");
        return;
      }

      setMessage(`Broadcast selesai. Success ${json.successCount}/${json.totalRecipients}, failed ${json.failedCount}.`);
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function applyCustomDays(user) {
    const days = Number(customDays || 0);
    if (!days || days < 1) {
      setMessage("Custom days minimal 1.");
      return;
    }
    updateUser(user, "premium", days);
  }

  function applyCustomDate(user) {
    if (!customDate) {
      setMessage("Isi custom date dulu.");
      return;
    }

    const until = new Date(`${customDate}T23:59:59.000Z`).toISOString();
    updateUser(user, "premium", 0, until);
  }

  return (
    <section className="adminPanel card compactAdminPanel">
      <div className="sectionTitle">
        <div>
          <span className="pill mini"><Settings size={14} /> ADMIN PANEL STEP 4</span>
          <h3>Advanced Premium Management</h3>
          <span>Compact mode: list user dibuat pendek, action ada di detail.</span>
        </div>
        <button type="button" onClick={loadUsers} disabled={busy}>
          <RefreshCcw size={16} className={busy ? "spin" : ""} /> Refresh Users
        </button>
      </div>

      <div className="adminStatsGrid compact">
        <AdminStat label="Total" value={stats.total} />
        <AdminStat label="Premium" value={stats.premiumActive} />
        <AdminStat label="Expired" value={stats.expired} />
        <AdminStat label="Admin" value={stats.admin} />
        <AdminStat label="Telegram" value={stats.telegramConnected} />
        <AdminStat label="Free" value={stats.free} />
      </div>

      <div className="adminControls advanced compact">
        <label>
          Admin Token
          <input
            value={adminToken}
            onChange={(event) => saveToken(event.target.value)}
            type="password"
            placeholder="Isi ADMIN_ACTION_TOKEN Cloudflare"
          />
        </label>
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari email / UID"
          />
        </label>
        <label>
          Role
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="expired">Expired</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Telegram
          <select value={telegramFilter} onChange={(event) => setTelegramFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="connected">Connected</option>
            <option value="not_connected">Not Connected</option>
          </select>
        </label>
      </div>

      <details className="adminToolsDetails">
        <summary>Broadcast & Custom Premium Tools</summary>

        <div className="adminCustomTools compact">
          <label>
            Custom Premium Days
            <input
              type="number"
              min="1"
              value={customDays}
              onChange={(event) => setCustomDays(event.target.value)}
            />
          </label>
          <label>
            Custom Expired Date
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
            />
          </label>
        </div>

        <div className="adminBroadcastBox compact">
          <div>
            <span className="pill mini"><Bot size={14} /> BROADCAST</span>
            <h4>Broadcast Telegram</h4>
            <p>Kirim pesan ke user Telegram yang sudah connect.</p>
          </div>
          <select value={broadcastTarget} onChange={(event) => setBroadcastTarget(event.target.value)}>
            <option value="premium_connected">Premium/Admin Connected</option>
            <option value="all_connected">All Connected</option>
            <option value="admin_connected">Admin Connected</option>
          </select>
          <textarea
            value={broadcastText}
            onChange={(event) => setBroadcastText(event.target.value)}
            placeholder="Contoh: XAU AI update malam ini."
          />
          <button type="button" onClick={broadcastTelegram} disabled={busy}>
            Send Broadcast
          </button>
        </div>
      </details>

      {message && <div className="adminMessage">{message}</div>}

      <div className="adminListToolbar">
        <b>{filteredUsers.length} user ditemukan</b>
        <span>Halaman {safePage}/{totalPages} · Maks {pageSize} user per halaman</span>
        <div>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1}>Prev</button>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages}>Next</button>
        </div>
      </div>

      <div className="adminCompactList">
        {pagedUsers.map((user) => {
          const expanded = expandedUid === user.uid;

          return (
            <div className="adminCompactRow" key={user.uid}>
              <button
                type="button"
                className="adminCompactMain"
                onClick={() => setExpandedUid(expanded ? "" : user.uid)}
              >
                <div>
                  <strong>{user.email || "-"}</strong>
                  <small>{user.uid}</small>
                </div>

                <b className={`roleBadge ${user.role || "free"}`}>{getRoleStatusLabel(user)}</b>

                <span className="compactPremium">{formatPremiumUntil(user)}</span>

                <div className={`telegramMiniStatus ${user.telegramConnected ? "connected" : ""}`}>
                  <b>{user.telegramConnected ? "TG OK" : "No TG"}</b>
                </div>

                <span className="expandHint">{expanded ? "Hide" : "Manage"}</span>
              </button>

              {expanded && (
                <div className="adminCompactDetail">
                  <div className="detailGrid">
                    <span><b>Created:</b> {formatShortDateTime(user.createdAt)}</span>
                    <span><b>Telegram:</b> {user.telegramUsername ? `@${user.telegramUsername}` : user.telegramChatId ? "Chat ID saved" : "-"}</span>
                    <span><b>Premium:</b> {formatPremiumUntil(user)}</span>
                  </div>

                  <div className="adminActions compact">
                    <button type="button" onClick={() => updateUser(user, "premium", 7)}>+7D</button>
                    <button type="button" onClick={() => updateUser(user, "premium", 30)}>+30D</button>
                    <button type="button" onClick={() => applyCustomDays(user)}>+Custom Days</button>
                    <button type="button" onClick={() => applyCustomDate(user)}>Set Date</button>
                    <button type="button" onClick={() => updateUser(user, "free")}>Free</button>
                    <button type="button" onClick={() => updateUser(user, "admin")}>Admin</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!pagedUsers.length && (
          <div className="emptyHistory">Belum ada user sesuai filter, atau token admin belum diisi.</div>
        )}
      </div>
    </section>
  );
}

function AdminStat({ label, value }) {
  return (
    <div className="adminStatCard">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function buildAdminStats(users) {
  const stats = {
    total: users.length,
    free: 0,
    premiumActive: 0,
    expired: 0,
    admin: 0,
    telegramConnected: 0
  };

  users.forEach((user) => {
    if (user.telegramConnected && user.telegramChatId) stats.telegramConnected += 1;
    if (user.role === "admin") {
      stats.admin += 1;
    } else if (user.role === "premium") {
      if (isAdminPremiumActive(user)) stats.premiumActive += 1;
      else stats.expired += 1;
    } else {
      stats.free += 1;
    }
  });

  return stats;
}

function isAdminPremiumActive(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  const until = user.premiumUntil || user.expiredAt || null;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

function getRoleStatusLabel(user) {
  if (user.role === "premium" && !isAdminPremiumActive(user)) return "EXPIRED";
  return (user.role || "free").toUpperCase();
}


function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (err) { setError(cleanAuthError(err)); }
    finally { setBusy(false); }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try { await loginWithGoogle(); }
    catch (err) { setError(cleanAuthError(err)); }
    finally { setBusy(false); }
  }

  return (
    <main className="page authPage">
      <section className="authCard card">
        <div className="logo big"><Bot size={30} /></div>
        <span className="pill mini"><Lock size={14} /> Premium Access</span>
        <h1>XAU AI Signal</h1>
        <p>Login dulu buat akses dashboard premium, MAIN CALL, M1 Scalp Radar, Fresh OB M15, dan history signal.</p>
        <form className="authForm" onSubmit={handleSubmit}>
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="email kamu" required />
          <label>Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="minimal 6 karakter" required />
          {error && <div className="authError">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? "Loading..." : mode === "register" ? "Create Account" : "Login"}</button>
          <button type="button" className="ghostBtn" onClick={handleGoogle} disabled={busy}>Login with Google</button>
        </form>
        <button className="linkBtn" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Belum punya akun? Register" : "Sudah punya akun? Login"}</button>
      </section>
    </main>
  );
}


function VerifyEmailScreen({ user, onLogout, onVerified }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleResend() {
    setBusy(true);
    setMessage("");

    try {
      await sendVerificationEmail(user);
      setMessage("Link verifikasi sudah dikirim ulang. Cek inbox/spam email kamu.");
    } catch (err) {
      setMessage(cleanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheck() {
    setBusy(true);
    setMessage("");

    try {
      await onVerified();
      setMessage("Status dicek. Kalau sudah verifikasi, dashboard akan terbuka otomatis. Kalau belum, cek email dulu.");
    } catch (err) {
      setMessage(cleanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page authPage">
      <section className="authCard paywallCard card">
        <div className="logo big"><Lock size={30} /></div>
        <span className="pill mini"><Shield size={14} /> EMAIL VERIFICATION</span>
        <h1>Verifikasi Email Dulu</h1>
        <p>Akun kamu sudah dibuat, tapi email perlu diverifikasi dulu untuk mencegah spam akun.</p>

        <div className="paywallUser">
          <b>{user?.email}</b>
          <span>Status: Email belum verified</span>
          <span>Cek inbox atau folder spam.</span>
        </div>

        {message && <div className="authError info">{message}</div>}

        <div className="paywallActions">
          <button type="button" onClick={handleResend} disabled={busy}>
            {busy ? "Loading..." : "Kirim Ulang Link"}
          </button>
          <button type="button" onClick={handleCheck} disabled={busy}>
            Saya Sudah Verifikasi
          </button>
        </div>

        <button className="linkBtn" type="button" onClick={onLogout}>
          Logout
        </button>

        <p className="miniNote">Setelah klik link verifikasi di email, balik ke halaman ini lalu tekan <b>Saya Sudah Verifikasi</b>.</p>
      </section>
    </main>
  );
}


function PaywallScreen({ user, profile, onLogout }) {
  return (
    <main className="page authPage">
      <section className="authCard paywallCard card">
        <div className="logo big"><Lock size={30} /></div>
        <span className="pill mini"><Shield size={14} /> FREE ACCOUNT</span>
        <h1>Upgrade ke Premium</h1>
        <p>Akun kamu sudah login, tapi belum punya akses premium aktif.</p>
        <div className="paywallUser">
          <b>{user?.email}</b>
          <span>UID: {user?.uid}</span>
          <span>Role: {(profile?.role || "free").toUpperCase()}</span>
          <span>Premium until: {profile?.premiumUntil || "-"}</span>
        </div>
        <div className="premiumFeatures">
          <b>Premium unlock:</b>
          <span>✅ Live dashboard XAU AI</span>
          <span>✅ MAIN CALL Alert</span>
          <span>✅ M1 Scalp Radar</span>
          <span>✅ Fresh OB M15</span>
          <span>✅ CALL & SCALP History</span>
        </div>
        <div className="paywallActions">
          <a href="https://t.me/" target="_blank" rel="noreferrer">Hubungi Admin</a>
          <button type="button" onClick={onLogout}>Logout</button>
        </div>
        <p className="miniNote">Admin bisa aktifkan premium via Firebase RTDB path <code>users/{user?.uid}</code> atau endpoint <code>/api/admin-user</code>.</p>
      </section>
    </main>
  );
}

function cleanAuthError(err) {
  const message = String(err?.message || err || "Login gagal");
  if (message.includes("auth/invalid-credential")) return "Email/password salah atau akun belum terdaftar.";
  if (message.includes("auth/email-already-in-use")) return "Email sudah terdaftar. Coba login.";
  if (message.includes("auth/weak-password")) return "Password minimal 6 karakter.";
  if (message.includes("auth/popup")) return "Popup Google diblokir. Coba izinkan popup atau pakai email/password.";
  if (message.includes("auth/too-many-requests")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (message.includes("auth/quota-exceeded")) return "Limit kirim email verifikasi sementara penuh. Coba lagi nanti.";
  return message;
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


function clearStructureLines(linesRef) {
  if (!linesRef.current) return;

  linesRef.current.forEach(({ series, line }) => {
    try {
      series.removePriceLine(line);
    } catch {}
  });

  linesRef.current = [];
}

function addStructureLines(series, linesRef, scalping) {
  clearStructureLines(linesRef);

  const newLines = [];
  const support = Number(scalping?.support);
  const resistance = Number(scalping?.resistance);
  const supportTouches = Number(scalping?.supportTouches || 0);
  const resistanceTouches = Number(scalping?.resistanceTouches || 0);

  if (Number.isFinite(support) && support > 0) {
    const line = series.createPriceLine({
      price: support,
      color: "#38bdf8",
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `M1 Support x${supportTouches || 1}`
    });
    newLines.push({ series, line });
  }

  if (Number.isFinite(resistance) && resistance > 0) {
    const line = series.createPriceLine({
      price: resistance,
      color: "#fb923c",
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `M1 Resistance x${resistanceTouches || 1}`
    });
    newLines.push({ series, line });
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
