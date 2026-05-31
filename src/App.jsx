import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from "firebase/auth";
const ADMIN_CONTACT_URL = "https://t.me/xauai_signal_bot";
const ADMIN_CONTACT_LABEL = "Hubungi Admin";
const PRODUCT_NAME = "XAU AI Signal";

const PAYMENT_QRIS_URL = "";
const PAYMENT_DANA = "08xxxxxxxxxx";
const PAYMENT_OVO = "08xxxxxxxxxx";
const PAYMENT_BANK = "BCA / BRI / Mandiri - Hubungi admin";
const PACKAGE_7D_PRICE = "Rp10K";
const PACKAGE_30D_PRICE = "Rp30K";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Activity, Bot, Clock, Copy, Database, Lock, LogOut, Radio, RefreshCcw, Settings, Shield, Sparkles, Target, TrendingDown, TrendingUp, User, Zap } from "lucide-react";
import { auth, createPaymentOrder, ensureUserProfile, getUserPaymentOrders,
  getUserProfile, hasFirebaseClientConfig, isPremiumProfile, listenAuth, loginWithEmail, loginWithGoogle, logout, refreshCurrentUser, registerWithEmail, resetPasswordEmail, sendVerificationEmail } from "./firebaseClient";


function getPublicAppUrl() {
  return (
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.APP_URL ||
    import.meta.env.DASHBOARD_URL ||
    window.location.origin
  ).replace(/\/$/, "");
}

function getAuthActionParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    mode: params.get("mode") || "",
    oobCode: params.get("oobCode") || "",
    continueUrl: params.get("continueUrl") || "",
    lang: params.get("lang") || "id"
  };
}

function FirebaseAuthActionPage({ auth }) {
  const [params] = useState(() => getAuthActionParams());
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Memvalidasi link keamanan...");
  const [busy, setBusy] = useState(false);

  const appUrl = getPublicAppUrl();
  const isResetPassword = params.mode === "resetPassword";
  const isVerifyEmail = params.mode === "verifyEmail";
  const isRecoverEmail = params.mode === "recoverEmail";

  useEffect(() => {
    let active = true;

    async function run() {
      if (!params.mode || !params.oobCode) {
        if (!active) return;
        setStatus("error");
        setMessage("Link tidak lengkap atau sudah rusak. Silakan minta link baru dari halaman login.");
        return;
      }

      try {
        if (isResetPassword) {
          const resetEmail = await verifyPasswordResetCode(auth, params.oobCode);
          if (!active) return;
          setEmail(resetEmail);
          setStatus("ready");
          setMessage("Link valid. Silakan buat sandi baru untuk akun Anda.");
          return;
        }

        if (isVerifyEmail || isRecoverEmail) {
          await applyActionCode(auth, params.oobCode);
          if (!active) return;
          setStatus("success");
          setMessage(isVerifyEmail ? "Email berhasil diverifikasi." : "Perubahan email berhasil dipulihkan.");
          return;
        }

        if (!active) return;
        setStatus("error");
        setMessage("Tipe aksi belum didukung oleh halaman ini.");
      } catch (error) {
        if (!active) return;
        console.error("Firebase auth action error:", error);
        setStatus("error");
        setMessage("Link tidak valid, sudah kedaluwarsa, atau sudah pernah digunakan. Silakan minta link baru.");
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [auth, params.mode, params.oobCode, isResetPassword, isVerifyEmail, isRecoverEmail]);

  async function handleResetPassword(event) {
    event.preventDefault();

    if (busy) return;

    if (newPassword.length < 6) {
      setStatus("ready");
      setMessage("Sandi minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("ready");
      setMessage("Konfirmasi sandi belum sama.");
      return;
    }

    setBusy(true);
    setMessage("Menyimpan sandi baru...");

    try {
      await confirmPasswordReset(auth, params.oobCode, newPassword);
      setStatus("success");
      setMessage("Sandi berhasil diganti. Silakan login dengan sandi baru.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Confirm password reset error:", error);
      setStatus("error");
      setMessage("Gagal mengganti sandi. Link mungkin sudah kedaluwarsa atau sudah digunakan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authActionShell">
      <section className="authActionCard">
        <div className="authActionIcon">🛡️</div>
        <span className="pill mini">SECURE ACCOUNT</span>
        <h1>
          {isResetPassword
            ? "Reset Sandi XAU AI Signal"
            : isVerifyEmail
              ? "Verifikasi Email"
              : "Aksi Akun"}
        </h1>
        <p className="authActionLead">
          Halaman aman untuk menyelesaikan proses akun melalui domain resmi XAU AI Signal.
        </p>

        <div className={`authActionNotice ${status}`}>
          {message}
        </div>

        {isResetPassword && status === "ready" ? (
          <form className="authActionForm" onSubmit={handleResetPassword}>
            <label>
              Email akun
              <input value={email} disabled />
            </label>

            <label>
              Sandi baru
              <input
                type="password"
                value={newPassword}
                placeholder="Minimal 6 karakter"
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <label>
              Ulangi sandi baru
              <input
                type="password"
                value={confirmPassword}
                placeholder="Ketik ulang sandi baru"
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan Sandi Baru"}
            </button>
          </form>
        ) : null}

        {status === "success" ? (
          <a className="authActionPrimaryLink" href={appUrl}>
            Kembali ke Dashboard
          </a>
        ) : null}

        {status === "error" ? (
          <a className="authActionPrimaryLink" href={appUrl}>
            Buka Halaman Login
          </a>
        ) : null}

        <small className="authActionFootnote">
          Domain resmi: www.xauaisignal.online
        </small>
      </section>
    </main>
  );
}

export default function App() {
  if (window.location.pathname === "/auth-action") {
    return <FirebaseAuthActionPage auth={auth} />;
  }

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
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState("signal");
  const [telegramConnect, setTelegramConnect] = useState(null);
  const [bybitFeed, setBybitFeed] = useState({ latest: null, status: null, cronError: null, loading: false, error: "" });

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

  async function loadBybitTestFeed() {
    setBybitFeed((previous) => ({ ...previous, loading: true, error: "" }));

    try {
      const baseUrl = "https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt";
      const [latestRes, statusRes, errorRes] = await Promise.all([
        fetch(`${baseUrl}/latest.json?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`${baseUrl}/status.json?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`${baseUrl}/error.json?ts=${Date.now()}`, { cache: "no-store" })
      ]);

      const latest = await latestRes.json();
      const status = await statusRes.json();
      const cronError = await errorRes.json();

      setBybitFeed({
        latest: latest || null,
        status: status || null,
        cronError: cronError || null,
        loading: false,
        error: ""
      });
    } catch (error) {
      setBybitFeed((previous) => ({
        ...previous,
        loading: false,
        error: error?.message || "Gagal membaca backup market stream."
      }));
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

  const mt5Status = getMt5Status(market);
  const shouldPauseHeavyRefresh = mt5Status.isStale;

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

    // Hemat RTDB:
    // Lite refresh tetap jalan lebih lambat untuk cek apakah MT5 hidup lagi.
    // Chart/history/scalp history dipause saat data MT5 stale.
    const liteInterval = setInterval(loadLiteData, shouldPauseHeavyRefresh ? 60000 : 12000);

    let chartInterval = null;
    let historyInterval = null;
    let scalpHistoryInterval = null;

    if (!shouldPauseHeavyRefresh) {
      chartInterval = setInterval(loadChartData, 45000);
      historyInterval = setInterval(loadHistoryData, 60000);
      scalpHistoryInterval = setInterval(loadScalpHistoryData, 90000);
    }

    return () => {
      clearInterval(liteInterval);
      if (chartInterval) clearInterval(chartInterval);
      if (historyInterval) clearInterval(historyInterval);
      if (scalpHistoryInterval) clearInterval(scalpHistoryInterval);
    };
  }, [authUser, authProfile?.role, authProfile?.premiumUntil, shouldPauseHeavyRefresh]);

  useEffect(() => {
    // Bybit test feed untuk sementara disembunyikan dari user biasa.
    // Hanya admin yang membaca path test ini supaya user tidak melihat data/API eksperimen.
    if (!authUser || authProfile?.role !== "admin") return;

    loadBybitTestFeed();
    const interval = setInterval(loadBybitTestFeed, 30000);

    return () => clearInterval(interval);
  }, [authUser, authProfile?.role]);

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
  }, [authUser, authProfile?.role, authProfile?.premiumUntil, activeDashboardTab, tvM1, tvM15]);

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
  const snapshotRows = [
    {
      id: "rsi",
      title: "RSI 14",
      value: signal?.strategy?.rsi ?? "-",
      status: confirmation.rsiBuyOk ? "BUY OK" : confirmation.rsiSellOk ? "SELL OK" : "WAIT",
      note: `BUY ${confirmation.rsiBuyOk ? "OK" : "-"} · SELL ${confirmation.rsiSellOk ? "OK" : "-"}`,
      detail: "RSI membaca momentum harga. Untuk CALL, RSI idealnya mendukung arah sinyal dan tidak bertabrakan dengan filter lain."
    },
    {
      id: "mfi",
      title: "MFI 14",
      value: signal?.strategy?.mfi ?? "-",
      status: confirmation.mfiBuyOk ? "BUY OK" : confirmation.mfiSellOk ? "SELL OK" : "WAIT",
      note: `BUY ${confirmation.mfiBuyOk ? "OK" : "-"} · SELL ${confirmation.mfiSellOk ? "OK" : "-"}`,
      detail: "MFI membaca tekanan buyer/seller berdasarkan harga dan volume. Ini membantu konfirmasi apakah dorongan market cukup kuat."
    },
    {
      id: "ema",
      title: "EMA Cross",
      value: humanize(signal?.strategy?.emaCross),
      status: trendBias,
      note: signal?.strategy?.crossAlert?.message || "Menunggu EMA cross.",
      detail: "EMA 9 dan EMA 20 dipakai sebagai filter trend pendek. CALL utama lebih aman saat arah EMA cocok dengan strategi."
    },
    {
      id: "obm15",
      title: "Fresh OB M15",
      value: obCardValue,
      status: freshBullOb ? "BUY AREA" : freshBearOb ? "SELL AREA" : "WAIT",
      note: obCardNote,
      detail: "Order Block M15 dipakai sebagai area penting. Fresh OB lebih diprioritaskan karena belum terlalu sering disentuh harga."
    },
    {
      id: "probability",
      title: "Probability",
      value: `${probability.score || 0}% · ${probability.label || "LOW"}`,
      status: probability.label || "LOW",
      note: (probability.checklist || []).join(" · ") || "Menunggu score.",
      detail: "Probability adalah rangkuman kecocokan beberapa filter. Semakin banyak filter cocok, semakin tinggi score sinyal."
    },
    {
      id: "scalp",
      title: "M1 Scalp",
      value: scalping.label || "SCALP WAIT",
      status: scalping.action || "WAIT",
      note: `${scalping.confidence || 0}% · ${scalping.action || "WAIT"}`,
      detail: scalping.reason || "M1 Scalp membaca peluang cepat berdasarkan struktur M1, EMA, dan konfirmasi candle."
    }
  ];
  const historyStats = callHistory?.stats || {};
  const scalpStats = scalpHistory?.stats || {};
  const telegramStatus = formatSignalAlertStatus(signal?.telegram);
  const premiumActive = isPremiumProfile(authProfile);
  const roleLabel = authProfile?.role?.toUpperCase?.() || "FREE";
  const isAdmin = authProfile?.role === "admin";
  const premiumInfo = getPremiumInfo(authProfile);
  const emailVerified = Boolean(authUser?.emailVerified || authProfile?.emailVerified || authProfile?.emailCodeVerified);

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
          <h1>Konfigurasi akses belum aktif</h1>
          <p>Lengkapi konfigurasi akses aplikasi di Cloudflare Pages agar login dan dashboard premium bisa digunakan.</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    if (!showAuthScreen) {
      return <LandingPage onLogin={() => setShowAuthScreen(true)} />;
    }

    return <AuthScreen onBack={() => setShowAuthScreen(false)} />;
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

  const dashboardTabs = [
    { id: "signal", label: "Sinyal", icon: <Zap size={15} /> },
    { id: "chart", label: "Candle", icon: <Activity size={15} /> },
    { id: "scalp", label: "Scalp Mode", icon: <Target size={15} /> },
    { id: "history", label: "History", icon: <Clock size={15} /> },
    { id: "telegram", label: "Telegram", icon: <Radio size={15} /> },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: <Settings size={15} /> }] : [])
  ];

  return (
    <main className="page compactDashboardPage">
      <header className="nav">
        <div className="brand">
          <div className="logo"><Bot size={22} /></div>
          <div>
            <b>XAU AI Signal</b>
            <span>Premium dashboard · Signal · Candle · Scalp Mode</span>
          </div>
        </div>
        <div className="navActions">
          <div className={`live ${mt5Status.isStale ? "stale" : ""}`}><Radio size={14} /> {mt5Status.label}</div>
          <div className="live"><Radio size={14} /> {telegramStatus}</div>
          <div className="accountBadge"><User size={15} /> {roleLabel}</div>
          <div className={`premiumExpiryBadge ${premiumInfo.expired ? "expired" : ""}`}>
            <Shield size={15} /> {premiumInfo.label}
          </div>
          <button className="navBtn danger" type="button" onClick={logout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {mt5Status.isStale && (
        <section className="mt5PauseBanner card">
          <div>
            <span className="pill mini">LIVE MARKET SYNC PAUSED</span>
            <h3>Sinkronisasi market sedang menunggu koneksi stabil</h3>
            <p>
              Data market terakhir masuk {mt5Status.lastText}. Chart dan riwayat dijeda sementara agar dashboard tidak menampilkan data lama sebagai data terbaru.
              Sistem akan mencoba tersambung kembali otomatis setiap 60 detik.
            </p>
          </div>
          <button type="button" onClick={() => loadData({ includeChart: true, includeHistory: true, includeScalpHistory: true })}>
            Cek Ulang Sekarang
          </button>
        </section>
      )}

      <section className="dashboardTabs card">
        <div className="dashboardTabScroll">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`dashboardTabBtn ${activeDashboardTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveDashboardTab(tab.id);
                if (tab.id === "chart") {
                  requestAnimationFrame(() => {
                    initChart("M1");
                    initChart("M15");
                  });
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => loadData({ includeChart: true, includeHistory: true, includeScalpHistory: true })} disabled={loading} className="dashboardRefreshBtn">
          <RefreshCcw size={15} /> {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      <div className="dataTickerBar slimTicker">
        <div className="tickerTrack">
          <span><Database size={14} /> Market Feed: <b>Premium Live Engine</b></span>
          <span><Activity size={14} /> M1 Stream: <b>{candlesM1.length || market?.m1Count || 0} candles</b></span>
          <span><Shield size={14} /> M15 Stream: <b>{candlesM15.length || market?.m15Count || 0} candles</b></span>
          <span>{isSell ? <TrendingDown size={14} /> : <TrendingUp size={14} />} Last Price: <b>{lastCandle?.close || "-"}</b></span>
          <span><Radio size={14} /> Feed Status: <b>{market?.receivedAt ? "Online" : "Syncing"}</b></span>
        </div>
      </div>

      {activeDashboardTab === "signal" && (
        <>
          <section className="hero cleanHero compactHero">
            <div className={`signalBox card ${signalTone}`}>
              <div className="signalTop"><b>{market?.symbol || "XAUUSD"}</b><span>{lastUpdate}</span></div>
              <h2>{readableSignal}</h2>
              <div className="confidence">{signal?.confidence || 0}% confidence</div>
              {signal?.reasonDetails?.checklist?.length > 0 && (
                <div className="reasonBuilderBox">
                  <div className="reasonBuilderTitle"><Sparkles size={14} /> AI Reason Builder</div>
                  <ul>
                    {signal.reasonDetails.checklist.slice(0, 5).map((item, idx) => (
                      <li key={`reason-${idx}`}>{item}</li>
                    ))}
                  </ul>
                  {signal.reasonDetails.blockers?.length > 0 && (
                    <div className="reasonBlockers">
                      <b>Yang ditunggu:</b> {signal.reasonDetails.blockers.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              )}
              <div className="tradePlan">
                <div><small>Entry</small><strong>{signal?.entry || "-"}</strong></div>
                <div><small>Stop Loss</small><strong>{signal?.sl || "-"}</strong></div>
                <div><small>Take Profit</small><strong>{signal?.tp || "-"}</strong></div>
              </div>
            </div>

            <section className="strategyPanel card compactImportantCard">
              <div className="strategyHeader">
                <div><span className="pill mini"><Target size={14} /> SNAPSHOT</span><h3>RSI + MFI + EMA + OB M15</h3></div>
                <div className={`biasBadge ${signalTone}`}>{trendBias}</div>
              </div>
              <div className="snapshotAccordion">
                {snapshotRows.map((row, index) => (
                  <SnapshotRow key={row.id} row={row} defaultOpen={index < 2} />
                ))}
              </div>
            </section>
          </section>
        </>
      )}

      {activeDashboardTab === "chart" && (
        <>
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
                <em><span></span> Quick scan 12s · Chart sync 45s</em>
              </div>
            </div>
            {chartError && <div className="chartError">Chart error: {chartError}</div>}
            <div className="tvChart" ref={chartM1BoxRef}>
              {tvM1.length === 0 && <div className="chartEmpty">Menunggu live candle M1 dari market engine...</div>}
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
              {tvM15.length === 0 && <div className="chartEmpty">Menunggu live candle M15 dari market engine...</div>}
            </div>
          </section>
        </>
      )}

      {activeDashboardTab === "scalp" && (
        <>
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


          <section className="historyPanel card scalpHistoryPanel">
            <div className="sectionTitle">
              <div>
                <h3>{isAdmin ? "SCALP M1 Valid History & Manual Result" : "SCALP M1 Performance"}</h3>
                <span>Hanya SCALP BUY/SELL valid yang disimpan agar riwayat tetap bersih dan ringan.</span>
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

            {!isAdmin && (
              <div className="premiumViewerNote scalpViewerNote">
                Pantau performa SCALP M1 valid, result, dan winrate secara ringkas.
              </div>
            )}

            <div className="historyTable">
              <div className={`historyHead ${isAdmin ? "adminMode" : "viewerMode"}`}>
                <span>Time</span>
                <span>Signal</span>
                <span>Entry</span>
                <span>SL / TP</span>
                <span>Score</span>
                <span>Result</span>
                {isAdmin && <span>Action</span>}
              </div>

              {(scalpHistory?.history || []).slice(0, 10).map((item) => (
                <div className={`historyRow ${isAdmin ? "adminMode" : "viewerMode"}`} key={item.id}>
                  <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
                  <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
                  <span>{item.entry}</span>
                  <span>{item.sl || "-"} / {item.tp || "-"}</span>
                  <span>{item.score ?? item.confidence ?? "-"}%</span>
                  <span className={`resultBadge ${(item.result || item.status || "OPEN").toLowerCase()}`}>
                    {item.result || item.status || "OPEN"}
                  </span>
                  {isAdmin && (
                    <div className="historyActions">
                      <button type="button" onClick={() => updateScalpResult(item.id, "WIN")}>WIN</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "LOSS")}>LOSS</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "BE")}>BE</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "OPEN")}>OPEN</button>
                    </div>
                  )}
                </div>
              ))}

              {(!scalpHistory?.history || scalpHistory.history.length === 0) && (
                <div className="emptyHistory">Belum ada SCALP BUY/SELL valid. History akan muncul otomatis saat scalp mode valid.</div>
              )}
            </div>
          </section>
        </>
      )}

      {activeDashboardTab === "history" && (
        <>
          <UserPaymentHistoryCard user={authUser} />
          <PerformanceAnalyticsPanel
            callHistory={callHistory}
            scalpHistory={scalpHistory}
            isAdmin={isAdmin}
          />

          <section className="historyPanel card">
            <div className="sectionTitle">
              <div>
                <h3>{isAdmin ? "CALL History & Manual Result" : "CALL History & Performance"}</h3>
                <span>{isAdmin ? "Auto-save saat CALL valid. Admin bisa tandai hasil manual untuk track performa." : "Riwayat CALL valid, result, dan performa signal terbaru."}</span>
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

            {!isAdmin && (
              <div className="premiumViewerNote">
                Pantau riwayat signal valid, result, dan winrate secara transparan.
              </div>
            )}

            {isAdmin && (
              <div className="adminTokenBox">
                <span>Kode admin untuk update Win/Loss</span>
                <input
                  value={adminToken}
                  onChange={(event) => saveAdminToken(event.target.value)}
                  placeholder="Isi ADMIN_ACTION_TOKEN Cloudflare"
                  type="password"
                />
              </div>
            )}

            <div className="historyTable">
              <div className={`historyHead ${isAdmin ? "adminMode" : "viewerMode"}`}>
                <span>Time</span>
                <span>Signal</span>
                <span>Entry</span>
                <span>SL / TP</span>
                <span>Prob</span>
                <span>Result</span>
                {isAdmin && <span>Action</span>}
              </div>

              {(callHistory?.history || []).slice(0, 12).map((item) => (
                <div className={`historyRow ${isAdmin ? "adminMode" : "viewerMode"}`} key={item.id}>
                  <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
                  <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
                  <span>{item.entry}</span>
                  <span>{item.sl || "-"} / {item.tp || "-"}</span>
                  <span>{item.probability?.score ?? item.confidence ?? "-"}%</span>
                  <span className={`resultBadge ${(item.result || item.status || "OPEN").toLowerCase()}`}>
                    {item.result || item.status || "OPEN"}
                  </span>
                  {isAdmin && (
                    <div className="historyActions">
                      <button type="button" onClick={() => updateCallResult(item.id, "WIN")}>WIN</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "LOSS")}>LOSS</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "BE")}>BE</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "OPEN")}>OPEN</button>
                    </div>
                  )}
                </div>
              ))}

              {(!callHistory?.history || callHistory.history.length === 0) && (
                <div className="emptyHistory">Belum ada CALL valid. History otomatis muncul saat signal BUY/SELL CALL.</div>
              )}
            </div>
          </section>


        </>
      )}

      {activeDashboardTab === "telegram" && (
        <TelegramConnectPanel
          user={authUser}
          profile={authProfile}
          telegramConnect={telegramConnect}
          onRefresh={loadTelegramConnectStatus}
        />
      )}

      {isAdmin && activeDashboardTab === "admin" && (
        <>
          <AdminPanel adminToken={adminToken} setAdminToken={setAdminToken} />
          <BybitTestFeedPanel feed={bybitFeed} market={market} mt5LastCandle={lastCandle} onRefresh={loadBybitTestFeed} />
          <section className="aiPanel card">
            <div className="strategyHeader">
              <div><span className="pill mini"><Sparkles size={14} /> AI MARKET ANALYSIS</span><h3>Analisa AI sinkron</h3></div>
              <div className={`biasBadge ${aiAnalysis?.mode === "ai-live" ? "buy" : "wait"}`}>{aiAnalysis?.mode === "ai-live" ? "AI Live" : "Fallback"}</div>
            </div>
            <div className="aiText">{formatAiText(aiAnalysis?.analysis || "Menunggu analisa AI...")}</div>
          </section>
        </>
      )}

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




function getMt5Status(market) {
  const rawTime = market?.receivedAt || market?.serverReceivedAt || market?.updatedAt || market?.timestamp || null;

  if (!rawTime) {
    return {
      isStale: true,
      ageMs: Infinity,
      label: "Market feed preparing",
      lastText: "belum ada data"
    };
  }

  let timeMs = 0;

  if (typeof rawTime === "number") {
    timeMs = rawTime > 1000000000000 ? rawTime : rawTime * 1000;
  } else {
    const parsed = Date.parse(String(rawTime).replace(" ", "T"));
    timeMs = Number.isFinite(parsed) ? parsed : 0;
  }

  if (!timeMs) {
    return {
      isStale: true,
      ageMs: Infinity,
      label: "Market sync checking",
      lastText: "sedang dicek"
    };
  }

  const ageMs = Date.now() - timeMs;
  const staleMs = 3 * 60 * 1000;
  const isStale = ageMs > staleMs;

  return {
    isStale,
    ageMs,
    label: isStale ? "Live feed reconnecting" : "Live market online",
    lastText: formatAge(ageMs)
  };
}

function formatSignalAlertStatus(telegram = {}) {
  if (telegram?.ok) return "Signal Alert Terkirim";

  const skipped = String(telegram?.skipped || telegram?.reason || "").toLowerCase();

  if (skipped === "not-call-signal") return "Menunggu setup valid";
  if (skipped === "duplicate-alert") return "Alert sudah dikirim";
  if (skipped === "cooldown-active") return "Alert cooldown aktif";
  if (skipped === "telegram-bot-token-missing") return "Alert gateway belum aktif";
  if (skipped === "telegram-chat-id-missing") return "Telegram belum terhubung";
  if (skipped.includes("missing")) return "Alert belum lengkap";
  if (skipped.includes("error")) return "Alert perlu dicek";

  return "Signal Alert Standby";
}

function formatAge(ageMs) {
  if (!Number.isFinite(ageMs)) return "unknown";
  if (ageMs < 0) return "baru saja";

  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return `${sec} detik lalu`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;

  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
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
          <h3>Connect Telegram Alert</h3>
          <p>Hubungkan akun dashboard ke bot Telegram agar alert premium masuk langsung ke chat kamu.</p>
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
        Setelah status Connected, akun ini siap menerima auto alert MAIN CALL via Telegram.
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
          <div className="emptyHistory">Belum ada user sesuai filter, atau kode admin belum diisi.</div>
        )}
      </div>
        <AdminOrdersPanel adminToken={adminToken} />
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






function safePaymentText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function safePaymentDate(value) {
  const text = safePaymentText(value, "");
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 18);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function UserPaymentHistoryCard({ user }) {
  const [orders, setOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");

  async function loadPaymentHistory() {
    if (!user?.uid) return;

    try {
      setLoadingHistory(true);
      setHistoryMessage("");

      const list = await getUserPaymentOrders(user.uid);
      setOrders(Array.isArray(list) ? list : []);

      if (!list?.length) {
        setHistoryMessage("Belum ada riwayat pembayaran.");
      }
    } catch (err) {
      setHistoryMessage(err?.message || "Gagal memuat riwayat pembayaran.");
      setOrders([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadPaymentHistory();
  }, [user?.uid]);

  const successOrders = orders.filter((order) => String(order?.status || "").toLowerCase() === "approved");
  const visibleOrders = orders.slice(0, 6);

  return (
    <section className="userPaymentHistory card">
      <div className="userPaymentHistoryHeader">
        <div>
          <span className="pill mini">PAYMENT HISTORY</span>
          <h3>Riwayat Pembayaran</h3>
          <p>Lihat status pembayaran dan paket premium yang pernah kamu ajukan.</p>
        </div>

        <button type="button" onClick={loadPaymentHistory} disabled={loadingHistory}>
          {loadingHistory ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="userPaymentHistoryStats">
        <span>Sukses <b>{successOrders.length}</b></span>
        <span>Total <b>{orders.length}</b></span>
      </div>

      {historyMessage ? <div className="userPaymentHistoryMessage">{historyMessage}</div> : null}

      <div className="userPaymentHistoryList">
        {visibleOrders.length ? visibleOrders.map((order) => {
          const status = String(order?.status || "pending").toLowerCase();

          return (
            <article className="userPaymentHistoryRow" key={safePaymentText(order?.orderId || `${order?.uid}_${order?.createdAt}`)}>
              <div>
                <b>{safePaymentText(order?.packageLabel || order?.packageCode)}</b>
                <small>Order ID: {safePaymentText(order?.orderId)}</small>
              </div>

              <div>
                <span>{safePaymentText(order?.price)}</span>
                <small>{safePaymentDate(order?.createdAt)}</small>
              </div>

              <div>
                <span className={`paymentHistoryStatus ${status}`}>{status.toUpperCase()}</span>
                <small>{status === "approved" ? `Aktif sampai: ${safePaymentDate(order?.premiumUntil)}` : "Menunggu proses admin"}</small>
              </div>
            </article>
          );
        }) : (
          <div className="userPaymentHistoryEmpty">
            Belum ada riwayat pembayaran. Buat order dari halaman paket premium terlebih dulu.
          </div>
        )}
      </div>
    </section>
  );
}


function PerformanceAnalyticsPanel({ callHistory, scalpHistory, isAdmin }) {
  const callItems = callHistory?.history || [];
  const scalpItems = scalpHistory?.history || [];

  const call7 = buildPerformanceStats(callItems, 7);
  const call30 = buildPerformanceStats(callItems, 30);
  const scalp7 = buildPerformanceStats(scalpItems, 7);
  const scalp30 = buildPerformanceStats(scalpItems, 30);

  const best = pickBestPerformance([
    { label: "MAIN CALL 7D", ...call7 },
    { label: "MAIN CALL 30D", ...call30 },
    { label: "SCALP M1 7D", ...scalp7 },
    { label: "SCALP M1 30D", ...scalp30 }
  ]);

  return (
    <section className="performancePanel card">
      <div className="sectionTitle">
        <div>
          <span className="pill mini">PERFORMANCE ANALYTICS</span>
          <h3>Winrate 7/30 Hari</h3>
          <span>Ringkasan performa dari signal yang sudah punya result WIN / LOSS / BE.</span>
        </div>
        <div className="performanceHighlight">
          <small>Best Snapshot</small>
          <b>{best ? `${best.label} · ${best.winRate}% WR` : "Waiting data"}</b>
        </div>
      </div>

      <div className="performanceGrid">
        <PerformanceCard title="MAIN CALL" period="7 Hari" stats={call7} />
        <PerformanceCard title="MAIN CALL" period="30 Hari" stats={call30} />
        <PerformanceCard title="SCALP M1" period="7 Hari" stats={scalp7} />
        <PerformanceCard title="SCALP M1" period="30 Hari" stats={scalp30} />
      </div>

      <div className="performanceSummary">
        <div>
          <b>Recent Summary</b>
          <span>{buildPerformanceSummary(call7, call30, scalp7, scalp30)}</span>
        </div>
        <div>
          <b>Catatan</b>
          <span>Winrate dihitung dari result yang sudah closed. OPEN tidak masuk hitungan WR.</span>
        </div>
      </div>

      {isAdmin && (
        <div className="performanceAdminNote">
          Admin mode: update result dari CALL/SCALP History agar analytics 7/30 hari tetap akurat.
        </div>
      )}
    </section>
  );
}

function PerformanceCard({ title, period, stats }) {
  const wrClass = stats.winRate >= 70 ? "strong" : stats.winRate >= 50 ? "normal" : "weak";

  return (
    <div className="performanceCard">
      <div className="performanceCardTop">
        <div>
          <span>{title}</span>
          <h4>{period}</h4>
        </div>
        <b className={wrClass}>{stats.winRate}%</b>
      </div>

      <div className="performanceBars">
        <div>
          <small>Closed</small>
          <strong>{stats.closed}</strong>
        </div>
        <div>
          <small>WIN</small>
          <strong>{stats.wins}</strong>
        </div>
        <div>
          <small>LOSS</small>
          <strong>{stats.losses}</strong>
        </div>
        <div>
          <small>BE</small>
          <strong>{stats.be}</strong>
        </div>
      </div>

      <div className="wrBar">
        <i style={{ width: `${Math.min(100, Math.max(0, stats.winRate))}%` }} />
      </div>

      <p>{stats.total} total signal · {stats.open} masih OPEN</p>
    </div>
  );
}

function buildPerformanceStats(items, days) {
  const now = Date.now();
  const from = now - days * 24 * 60 * 60 * 1000;

  const filtered = (items || []).filter((item) => {
    const t = parseHistoryTimeMs(item.createdAt || item.candleTime || item.time || item.timestamp);
    if (!t) return true; // data lama tanpa timestamp tetap dihitung supaya tidak kosong
    return t >= from;
  });

  let wins = 0;
  let losses = 0;
  let be = 0;
  let open = 0;

  filtered.forEach((item) => {
    const result = String(item.result || item.status || "OPEN").toUpperCase();

    if (result === "WIN") wins += 1;
    else if (result === "LOSS") losses += 1;
    else if (result === "BE" || result === "BREAKEVEN") be += 1;
    else open += 1;
  });

  const closed = wins + losses + be;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;

  return {
    days,
    total: filtered.length,
    closed,
    wins,
    losses,
    be,
    open,
    winRate
  };
}

function parseHistoryTimeMs(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value > 1000000000000 ? value : value * 1000;
  }

  const parsed = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickBestPerformance(statsList) {
  const valid = statsList.filter((item) => item.closed >= 3);
  if (!valid.length) return null;

  return valid.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.closed - a.closed;
  })[0];
}

function buildPerformanceSummary(call7, call30, scalp7, scalp30) {
  const parts = [];

  if (call7.closed > 0) parts.push(`MAIN CALL 7D WR ${call7.winRate}% dari ${call7.closed} closed signal`);
  if (scalp7.closed > 0) parts.push(`SCALP M1 7D WR ${scalp7.winRate}% dari ${scalp7.closed} closed signal`);

  if (!parts.length) {
    if (call30.closed || scalp30.closed) {
      return `Data 7 hari masih tipis. 30D: MAIN CALL ${call30.winRate}% WR, SCALP M1 ${scalp30.winRate}% WR.`;
    }

    return "Analytics akan makin akurat setelah result WIN/LOSS/BE mulai terkumpul.";
  }

  return parts.join(" · ");
}




function safeOrderText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function safeOrderDate(value) {
  const text = safeOrderText(value, "");
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 18);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeOrderForUi(order) {
  const safe = order && typeof order === "object" && !Array.isArray(order) ? order : {};

  return {
    orderId: safeOrderText(safe.orderId || safe.id || `order_${Math.random().toString(16).slice(2)}`),
    uid: safeOrderText(safe.uid),
    email: safeOrderText(safe.email),
    packageCode: safeOrderText(safe.packageCode),
    packageLabel: safeOrderText(safe.packageLabel || safe.packageCode),
    price: safeOrderText(safe.price),
    status: safeOrderText(safe.status || "pending").toLowerCase(),
    createdAt: safeOrderText(safe.createdAt),
    premiumUntil: safeOrderText(safe.premiumUntil, ""),
    approvedAt: safeOrderText(safe.approvedAt, ""),
    adminNote: safeOrderText(safe.adminNote, ""),
    adminNoteUpdatedAt: safeOrderText(safe.adminNoteUpdatedAt, "")
  };
}


function AdminOrderNoteBox({ order, onSave }) {
  const [note, setNote] = useState(order.adminNote || "");

  useEffect(() => {
    setNote(order.adminNote || "");
  }, [order.orderId, order.adminNote]);

  return (
    <div className="adminOrderNoteBox">
      <label>Catatan Admin</label>
      <textarea
        value={note}
        maxLength={500}
        placeholder="Contoh: Transfer DANA 30K sudah masuk, approve manual."
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="adminOrderNoteFooter">
        <small>{note.length}/500</small>
        <button type="button" onClick={() => onSave(order, note)}>
          Save Note
        </button>
      </div>
      {order.adminNoteUpdatedAt ? (
        <small className="adminOrderNoteUpdated">Updated: {safeOrderDate(order.adminNoteUpdatedAt)}</small>
      ) : null}
    </div>
  );
}




function csvCell(value) {
  const text = safeOrderText(value, "")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .trim();

  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function formatCsvDate(value) {
  const text = safeOrderText(value, "");
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function exportOrdersToCsv(orders, filterLabel = "orders") {
  const safeOrders = Array.isArray(orders) ? orders.map(normalizeOrderForUi) : [];

  const headers = [
    "Order ID",
    "Email",
    "UID",
    "Paket",
    "Harga",
    "Status",
    "Tanggal Order",
    "Premium Sampai",
    "Catatan Admin"
  ];

  const rows = safeOrders.map((order) => [
    order.orderId,
    order.email,
    order.uid,
    order.packageLabel || order.packageCode,
    order.price,
    safeOrderText(order.status).toUpperCase(),
    formatCsvDate(order.createdAt),
    formatCsvDate(order.premiumUntil),
    order.adminNote
  ]);

  // Excel Indonesia sering membaca CSV dengan delimiter titik koma.
  // Baris sep=; membantu Excel membuka file langsung dalam kolom terpisah.
  const delimiter = ";";
  const csv = [
    "sep=;",
    headers.map(csvCell).join(delimiter),
    ...rows.map((row) => row.map(csvCell).join(delimiter))
  ].join("\r\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `xau-payment-orders-${filterLabel}-${date}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}



function parseOrderPriceToNumber(value) {
  const text = safeOrderText(value, "0").toLowerCase();

  if (text.includes("30")) return 30000;
  if (text.includes("10")) return 10000;

  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatRupiahShort(value) {
  const amount = Number(value || 0);

  if (amount >= 1000000) {
    const million = amount / 1000000;
    return `Rp${million % 1 === 0 ? million.toFixed(0) : million.toFixed(1)}JT`;
  }

  if (amount >= 1000) {
    return `Rp${Math.round(amount / 1000)}K`;
  }

  return `Rp${amount}`;
}

function isSameMonth(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isWithinLastDays(dateValue, days) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const diff = Date.now() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function getPaymentRevenueSummary(orders) {
  const safeOrders = Array.isArray(orders) ? orders.map(normalizeOrderForUi) : [];
  const approved = safeOrders.filter((order) => order.status === "approved");
  const pending = safeOrders.filter((order) => order.status === "pending");
  const rejected = safeOrders.filter((order) => order.status === "rejected");

  const approvedThisMonth = approved.filter((order) => isSameMonth(order.approvedAt || order.createdAt));
  const approvedLast7Days = approved.filter((order) => isWithinLastDays(order.approvedAt || order.createdAt, 7));
  const package7d = approved.filter((order) => safeOrderText(order.packageLabel || order.packageCode).includes("7"));
  const package30d = approved.filter((order) => safeOrderText(order.packageLabel || order.packageCode).includes("30"));

  const revenueThisMonth = approvedThisMonth.reduce((sum, order) => sum + parseOrderPriceToNumber(order.price), 0);
  const revenueLast7Days = approvedLast7Days.reduce((sum, order) => sum + parseOrderPriceToNumber(order.price), 0);
  const revenueAll = approved.reduce((sum, order) => sum + parseOrderPriceToNumber(order.price), 0);

  return {
    revenueThisMonth,
    revenueLast7Days,
    revenueAll,
    approvedCount: approved.length,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    package7dCount: package7d.length,
    package30dCount: package30d.length
  };
}

function PaymentRevenueSummary({ orders }) {
  const summary = getPaymentRevenueSummary(orders);

  return (
    <section className="paymentRevenueSummary">
      <div className="paymentRevenueHeader">
        <span className="pill mini">REVENUE SUMMARY</span>
        <h3>Payment Summary</h3>
        <p>Ringkasan order approved dan estimasi omzet dari paket premium.</p>
      </div>

      <div className="paymentRevenueGrid">
        <div>
          <small>Bulan ini</small>
          <b>{formatRupiahShort(summary.revenueThisMonth)}</b>
        </div>
        <div>
          <small>7 hari terakhir</small>
          <b>{formatRupiahShort(summary.revenueLast7Days)}</b>
        </div>
        <div>
          <small>Total omzet</small>
          <b>{formatRupiahShort(summary.revenueAll)}</b>
        </div>
        <div>
          <small>Approved</small>
          <b>{summary.approvedCount}</b>
        </div>
        <div>
          <small>Pending</small>
          <b>{summary.pendingCount}</b>
        </div>
        <div>
          <small>Rejected</small>
          <b>{summary.rejectedCount}</b>
        </div>
        <div>
          <small>Paket 7D</small>
          <b>{summary.package7dCount}</b>
        </div>
        <div>
          <small>Paket 30D</small>
          <b>{summary.package30dCount}</b>
        </div>
      </div>
    </section>
  );
}



function orderMatchesSearch(order, query) {
  const keyword = safeOrderText(query, "").trim().toLowerCase();
  if (!keyword) return true;

  const haystack = [
    order.orderId,
    order.email,
    order.uid,
    order.packageCode,
    order.packageLabel,
    order.price,
    order.status,
    order.createdAt,
    order.premiumUntil,
    order.adminNote
  ].map((value) => safeOrderText(value, "").toLowerCase()).join(" ");

  return haystack.includes(keyword);
}


function AdminOrdersPanel({ adminToken }) {
  const [orders, setOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [orderFilter, setOrderFilter] = useState("pending");
  const [orderSearch, setOrderSearch] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");

  async function loadOrders() {
    if (!adminToken) {
      setOrderMessage("Isi kode admin dulu untuk melihat order.");
      return;
    }

    try {
      setLoadingOrders(true);
      setOrderMessage("");

      const res = await fetch("/api/admin-orders", {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(safeOrderText(data.error, "Gagal load order."));
      }

      const list = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list.map(normalizeOrderForUi));
      setOrdersPage(1);
    } catch (err) {
      setOrderMessage(safeOrderText(err?.message, "Gagal load order."));
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateOrder(order, action) {
    if (!adminToken) {
      setOrderMessage("Isi kode admin dulu.");
      return;
    }

    try {
      setOrderMessage(action === "approve" ? "Memproses approval order..." : "Memproses reject order...");

      const days = safeOrderText(order.packageCode || order.packageLabel).includes("7") ? 7 : 30;

      const res = await fetch("/api/admin-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          orderId: order.orderId,
          days
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(safeOrderText(data.error, "Gagal update order."));
      }

      const notifyReason = data.telegramNotify?.reason || "";
      const notifyText = data.telegramNotify?.ok
        ? " Notif Telegram user terkirim."
        : data.telegramNotify?.skipped
          ? notifyReason === "telegram-bot-token-missing"
            ? " Koneksi Telegram belum tersedia."
            : " User belum connect Telegram / chat ID tidak ditemukan."
          : " Notif Telegram user tidak terkirim.";

      const emailText = data.emailNotify?.ok
        ? " Email user terkirim."
        : data.emailNotify?.skipped
          ? " Email approval belum aktif."
          : " Email user tidak terkirim.";

      setOrderMessage((action === "approve" ? "Order approved dan premium aktif." : "Order ditolak.") + notifyText + emailText);
      await loadOrders();
    } catch (err) {
      setOrderMessage(safeOrderText(err?.message, "Gagal update order."));
    }
  }


  async function saveOrderNote(order, note) {
    if (!adminToken) {
      setOrderMessage("Isi kode admin dulu.");
      return;
    }

    try {
      setOrderMessage("Menyimpan catatan order...");

      const res = await fetch("/api/admin-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: "saveNote",
          orderId: order.orderId,
          adminNote: note
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(safeOrderText(data.error, "Gagal menyimpan catatan."));
      }

      setOrders((current) => current.map((item) => {
        const safeItem = normalizeOrderForUi(item);
        if (safeItem.orderId !== order.orderId) return item;

        return {
          ...item,
          adminNote: note,
          adminNoteUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }));

      setOrderMessage("Catatan order berhasil disimpan.");
    } catch (err) {
      setOrderMessage(safeOrderText(err?.message, "Gagal menyimpan catatan."));
    }
  }

  const safeOrders = Array.isArray(orders) ? orders.map(normalizeOrderForUi) : [];
  const pendingOrders = safeOrders.filter((order) => order.status === "pending");
  const approvedOrders = safeOrders.filter((order) => order.status === "approved");
  const rejectedOrders = safeOrders.filter((order) => order.status === "rejected");
  const statusFilteredOrders = orderFilter === "all"
    ? safeOrders
    : safeOrders.filter((order) => order.status === orderFilter);

  const filteredOrders = statusFilteredOrders.filter((order) => orderMatchesSearch(order, orderSearch));

  const ordersPerPage = 6;
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const currentOrdersPage = Math.min(Math.max(ordersPage, 1), totalOrderPages);
  const recentOrders = filteredOrders.slice(
    (currentOrdersPage - 1) * ordersPerPage,
    currentOrdersPage * ordersPerPage
  );

  return (
    <section className="adminOrdersPanel">
      <div className="adminOrdersHeader">
        <div>
          <span className="pill mini">STEP 8B</span>
          <h3>Pending Payment Orders</h3>
          <p>Order dari user yang klik Konfirmasi Pembayaran. Approve akan mengaktifkan premium otomatis sesuai paket.</p>
        </div>

        <div className="adminOrdersHeaderActions">
          <button type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Loading..." : "Refresh Orders"}
          </button>
          <button
            type="button"
            onClick={() => exportOrdersToCsv(filteredOrders, orderSearch ? `${orderFilter}-search` : orderFilter)}
            disabled={!filteredOrders.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="adminOrdersStats">
        <span>Pending <b>{pendingOrders.length}</b></span>
        <span>Approved <b>{approvedOrders.length}</b></span>
        <span>Rejected <b>{rejectedOrders.length}</b></span>
        <span>Total <b>{safeOrders.length}</b></span>
      </div>

      <PaymentRevenueSummary orders={safeOrders} />

      <div className="adminOrdersFilter">
        {[
          ["pending", "Pending"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
          ["all", "All"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={orderFilter === value ? "active" : ""}
            onClick={() => {
              setOrderFilter(value);
              setOrdersPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="adminOrdersSearch">
        <label>Search Order</label>
        <div>
          <input
            type="search"
            value={orderSearch}
            placeholder="Cari email, UID, order ID, paket, status, catatan..."
            onChange={(event) => {
              setOrderSearch(event.target.value);
              setOrdersPage(1);
            }}
          />
          {orderSearch ? (
            <button
              type="button"
              onClick={() => {
                setOrderSearch("");
                setOrdersPage(1);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <small>Menampilkan {filteredOrders.length} order dari {statusFilteredOrders.length} order pada filter aktif.</small>
      </div>


      {orderMessage ? <div className="adminOrdersMessage">{safeOrderText(orderMessage)}</div> : null}

      <div className="adminOrdersList">
        {recentOrders.length ? recentOrders.map((order) => (
          <article className="adminOrderRow" key={order.orderId}>
            <div>
              <b>{order.email}</b>
              <small>{order.orderId}</small>
              <small>UID: {order.uid}</small>
            </div>

            <div>
              <span className="orderBadge">{order.packageLabel}</span>
              <small>{order.price}</small>
            </div>

            <div>
              <span className={`orderStatus ${order.status}`}>
                {order.status.toUpperCase()}
              </span>
              <small>{safeOrderDate(order.createdAt)}</small>
            </div>

            <div className="adminOrderActions">
              {order.status === "pending" ? (
                <>
                  <button type="button" onClick={() => updateOrder(order, "approve")}>Approve</button>
                  <button type="button" onClick={() => updateOrder(order, "reject")}>Reject</button>
                </>
              ) : (
                <small>{order.premiumUntil ? `Premium: ${safeOrderDate(order.premiumUntil)}` : "Processed"}</small>
              )}
            </div>

            <AdminOrderNoteBox order={order} onSave={saveOrderNote} />
          </article>
        )) : (
          <div className="adminOrdersEmpty">
            Belum ada order untuk filter ini. Klik Refresh Orders untuk memuat data terbaru.
          </div>
        )}
      </div>

      {filteredOrders.length > ordersPerPage ? (
        <div className="adminOrdersPager">
          <button
            type="button"
            onClick={() => setOrdersPage((page) => Math.max(1, page - 1))}
            disabled={currentOrdersPage <= 1}
          >
            Prev
          </button>

          <span>Page {currentOrdersPage} / {totalOrderPages}</span>

          <button
            type="button"
            onClick={() => setOrdersPage((page) => Math.min(totalOrderPages, page + 1))}
            disabled={currentOrdersPage >= totalOrderPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}


function LandingPage({ onLogin }) {
  return (
    <main className="landingPage">
      <nav className="landingNav">
        <div className="landingBrand">
          <div className="landingLogo">X</div>
          <div>
            <b>XAU AI Signal</b>
            <span>Gold Market Scanner</span>
          </div>
        </div>

        <div className="landingNavActions">
          <a href="#features">Fitur</a>
          <a href="#pricing">Paket</a>
          <a href="#faq">FAQ</a>
          <div className="landingFooterActions">
          <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Admin</a>
          <button type="button" onClick={onLogin}>Login / Register</button>
        </div>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingHeroText">
          <span className="pill mini">PREMIUM XAUUSD ASSISTANT</span>
          <h1>Dashboard signal XAUUSD dengan alert Telegram premium.</h1>
          <p>
            XAU AI Signal membantu memantau market gold dengan kombinasi market structure,
            EMA 9/20, M1 scalping radar, Fresh OB M15, dan history performa signal.
          </p>

          <div className="landingCta">
            <button type="button" onClick={onLogin}>Mulai Login / Register</button>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Admin</a>
            <a href="#features">Lihat Fitur</a>
          </div>

          <div className="landingTrust">
            <span>Telegram Alert</span>
            <span>M1 Scalp Radar</span>
            <span>CALL History</span>
          </div>
        </div>

        <div className="landingHeroCard">
          <div className="heroSignalTop">
            <span>MAIN CALL PREVIEW</span>
            <b>AI Market Scanner</b>
          </div>

          <div className="heroSignalBox">
            <small>Signal Mode</small>
            <strong>BUY / SELL CALL</strong>
            <p>Valid saat konfirmasi utama terpenuhi.</p>
          </div>

          <div className="heroSignalGrid">
            <div><small>Trend</small><b>EMA 9/20</b></div>
            <div><small>Momentum</small><b>RSI + MFI</b></div>
            <div><small>Area</small><b>Fresh OB M15</b></div>
            <div><small>Alert</small><b>Telegram</b></div>
          </div>
        </div>
      </section>

      <section className="landingStats">
        <div><b>MAIN CALL</b><span>Signal utama berbasis konfirmasi</span></div>
        <div><b>M1 SCALP</b><span>Radar scalping struktur M1</span></div>
        <div><b>M15 OB</b><span>Fresh order block monitoring</span></div>
        <div><b>History</b><span>Winrate & result transparan</span></div>
      </section>

      <section className="landingSection" id="features">
        <div className="landingSectionTitle">
          <span className="pill mini">FITUR PREMIUM</span>
          <h2>Apa yang user dapat?</h2>
          <p>Dashboard dibuat untuk membaca kondisi market secara cepat tanpa harus bolak-balik cek banyak indikator.</p>
        </div>

        <div className="landingFeatureGrid">
          <LandingFeature title="MAIN CALL Alert" text="Signal BUY/SELL CALL saat kondisi utama sudah valid." />
          <LandingFeature title="M1 Scalp Radar" text="Pantau setup scalping M1 dengan support/resistance, engulfing, dan arah EMA." />
          <LandingFeature title="Fresh OB M15" text="Monitoring demand/supply fresh order block untuk area penting market." />
          <LandingFeature title="Telegram Alert" text="User premium bisa connect Telegram untuk menerima alert langsung." />
          <LandingFeature title="Live Chart" text="Chart M1/M15, EMA 9/20, area struktur, dan market status." />
          <LandingFeature title="Performance History" text="Riwayat signal valid, result, dan winrate untuk evaluasi transparan." />
        </div>
      </section>

      <section className="landingSection landingHow">
        <div className="landingSectionTitle">
          <span className="pill mini">CARA KERJA</span>
          <h2>Simple untuk user premium</h2>
        </div>

        <div className="landingSteps">
          <div><b>1</b><span>Daftar / login akun</span></div>
          <div><b>2</b><span>Aktifkan premium via admin</span></div>
          <div><b>3</b><span>Connect Telegram Alert</span></div>
          <div><b>4</b><span>Pantau signal dan history</span></div>
        </div>
      </section>

      <section className="landingSection" id="pricing">
        <div className="landingSectionTitle">
          <span className="pill mini">PAKET BETA</span>
          <h2>Pilih paket premium</h2>
          <p>Paket beta hemat untuk akses dashboard premium. Aktivasi premium diproses manual oleh admin.</p>
        </div>

        <div className="pricingGrid">
          <div className="priceCard">
            <span>Trial</span>
            <h3>7 Day</h3>
            <b>Rp10K</b>
            <p>Cocok untuk coba fitur premium selama 7 hari.</p>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Aktivasi 7 Day</a>
          </div>
          <div className="priceCard featured">
            <span>Popular</span>
            <h3>30 Day</h3>
            <b>Rp30K</b>
            <p>Akses premium 30 hari untuk pantau XAUUSD.</p>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Aktivasi 30 Day</a>
          </div>
          <div className="priceCard">
            <span>Beta</span>
            <h3>Manual Access</h3>
            <b>Admin</b>
            <p>Aktivasi manual setelah pembayaran atau konfirmasi admin.</p>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Chat Admin</a>
          </div>
        </div>
      </section>



      <section className="landingSection manualPaymentSection" id="payment">
        <div className="landingSectionTitle">
          <span className="pill mini">MANUAL PAYMENT</span>
          <h2>Cara aktivasi premium</h2>
          <p>Pilih paket di atas, lakukan pembayaran, lalu kirim bukti bayar ke admin. Premium akan diaktifkan manual setelah pembayaran dikonfirmasi.</p>
        </div>

        <div className="activationPaymentBox">
          <div className="paymentStepsBox">
            <b>Alur Aktivasi:</b>
            <span>1. Register akun dan verifikasi email.</span>
            <span>2. Pilih paket 7 Day atau 30 Day.</span>
            <span>3. Transfer / minta QRIS ke admin.</span>
            <span>4. Kirim email akun + bukti bayar.</span>
            <span>5. Admin aktifkan premium, lalu kamu bisa login dashboard.</span>
          </div>

          <div className="paymentMethodCard compactPayment">
            <span>Metode Pembayaran</span>
            <h3>Manual</h3>
            <p>DANA/OVO: {PAYMENT_DANA}<br />Bank: {PAYMENT_BANK}</p>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Minta QRIS / Konfirmasi</a>
          </div>
        </div>
      </section>

      <section className="landingDisclaimer">
        <b>Risk Disclaimer</b>
        <p>
          XAU AI Signal adalah market scanner dan trading assistant, bukan jaminan profit.
          Trading XAUUSD memiliki risiko tinggi. Gunakan risk management, batasi lot, dan pastikan keputusan trading tetap berdasarkan tanggung jawab masing-masing user.
        </p>
      </section>

      <section className="landingSection" id="faq">
        <div className="landingSectionTitle">
          <span className="pill mini">FAQ</span>
          <h2>Pertanyaan umum</h2>
        </div>

        <div className="faqGrid">
          <details open>
            <summary>Apakah ini auto trade?</summary>
            <p>Bukan. Ini dashboard scanner dan alert. Eksekusi tetap manual oleh user.</p>
          </details>
          <details>
            <summary>Apakah pasti profit?</summary>
            <p>Tidak. Market gold sangat volatil. Signal membantu membaca setup, bukan menjamin hasil.</p>
          </details>
          <details>
            <summary>Apakah ada Telegram alert?</summary>
            <p>Ada. User premium bisa connect Telegram untuk menerima alert utama.</p>
          </details>
          <details>
            <summary>Bagaimana aktivasi premium?</summary>
            <p>Daftar akun, hubungi admin, lalu premium akan diaktifkan sesuai paket.</p>
          </details>
        </div>
      </section>

      <footer className="landingFooter">
        <div>
          <b>XAU AI Signal</b>
          <span>AI market scanner untuk XAUUSD.</span>
        </div>
        <button type="button" onClick={onLogin}>Login / Register</button>
      </footer>
    </main>
  );
}

function LandingFeature({ title, text }) {
  return (
    <div className="landingFeatureCard">
      <div className="featureIcon">✓</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}


function AuthScreen({ onBack }) {
  const [mode, setMode] = useState("login");
  const [resetMode, setResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);

    try {
      if (resetMode) {
        await resetPasswordEmail(email.trim());
        setInfo("Link reset password sudah dikirim. Cek inbox atau folder spam email kamu.");
        setResetMode(false);
        return;
      }

      if (mode === "register") await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (err) {
      setError(cleanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setInfo("");
    setBusy(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      setError(cleanAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  function openResetMode() {
    setResetMode(true);
    setError("");
    setInfo("");
  }

  function backToLogin() {
    setResetMode(false);
    setMode("login");
    setError("");
    setInfo("");
  }

  return (
    <main className="page authPage">
      {onBack && (
        <button className="landingBackBtn" type="button" onClick={onBack}>
          ← Kembali ke Beranda
        </button>
      )}

      <section className="authCard card">
        <div className="logo big"><Bot size={30} /></div>
        <span className="pill mini"><Lock size={14} /> Premium Access</span>

        <h1>{resetMode ? "Reset Password" : mode === "login" ? "XAU AI Signal" : "Daftar Akun"}</h1>

        <p>
          {resetMode
            ? "Masukkan email akun kamu. Link reset password akan dikirim lewat email."
            : mode === "login"
              ? "Login dulu buat akses dashboard premium, MAIN CALL, M1 Scalp Radar, Fresh OB M15, dan history signal."
              : "Buat akun dulu, lalu verifikasi email untuk lanjut ke premium access."}
        </p>

        <form className="authForm" onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="email kamu"
            required
          />

          {!resetMode && (
            <>
              <label>Password</label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="minimal 6 karakter"
                required
              />
            </>
          )}

          {error && <div className="authError">{error}</div>}
          {info && <div className="authError info">{info}</div>}

          <button type="submit" disabled={busy}>
            {busy ? "Loading..." : resetMode ? "Kirim Link Reset Password" : mode === "register" ? "Create Account" : "Login"}
          </button>

          {mode === "login" && !resetMode && (
            <button type="button" className="forgotPasswordBtn" onClick={openResetMode}>
              Lupa password?
            </button>
          )}

          {resetMode && (
            <button type="button" className="forgotPasswordBtn" onClick={backToLogin}>
              ← Kembali ke Login
            </button>
          )}

          {!resetMode && (
            <button type="button" className="ghostBtn" onClick={handleGoogle} disabled={busy}>
              Login with Google
            </button>
          )}
        </form>

        {!resetMode && (
          <button
            className="linkBtn"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setInfo("");
            }}
          >
            {mode === "login" ? "Belum punya akun? Register" : "Sudah punya akun? Login"}
          </button>
        )}
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
  const [selectedPackage, setSelectedPackage] = useState("30D");
  const [paymentOrderStatus, setPaymentOrderStatus] = useState("");
  const [localOrderPending, setLocalOrderPending] = useState(String(profile?.lastPaymentStatus || "").toLowerCase() === "pending");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const selectedPackageInfo = selectedPackage === "7D"
    ? { label: "7 Day", price: PACKAGE_7D_PRICE }
    : { label: "30 Day", price: PACKAGE_30D_PRICE };

  const activationText = [
    `Halo admin, saya ingin aktivasi premium XAU AI Signal.`,
    `Paket: ${selectedPackageInfo.label} (${selectedPackageInfo.price})`,
    `Email: ${user?.email || profile?.email || "-"}`,
    `UID: ${user?.uid || profile?.uid || "-"}`
  ].join("\\n");

  async function copyActivationInfo() {
    try {
      await navigator.clipboard.writeText(activationText);
      alert("Info aktivasi berhasil dicopy. Kirim ke admin bersama bukti pembayaran.");
    } catch {
      alert(activationText);
    }
  }

  async function submitPaymentOrder() {
    if (localOrderPending || String(profile?.lastPaymentStatus || "").toLowerCase() === "pending") {
      setPaymentOrderStatus("Kamu masih punya order pending. Kirim bukti pembayaran ke admin, lalu tunggu konfirmasi.");
      return;
    }

    try {
      setIsSubmittingOrder(true);
      setPaymentOrderStatus("");

      const order = await createPaymentOrder({
        user,
        profile,
        packageCode: selectedPackage,
        packageLabel: selectedPackageInfo.label,
        price: selectedPackageInfo.price
      });

      setLocalOrderPending(true);
      if (order.duplicate) {
        setPaymentOrderStatus(order.message || `Order pending sudah ada. ID: ${order.orderId}. Kirim bukti pembayaran ke admin.`);
      } else {
        setPaymentOrderStatus(`Order pending berhasil dibuat. ID: ${order.orderId}. Kirim bukti pembayaran ke admin agar premium bisa diaktifkan.`);
      }
    } catch (err) {
      setPaymentOrderStatus(err?.message || "Gagal membuat order pending.");
    } finally {
      setIsSubmittingOrder(false);
    }
  }


  return (
    <main className="page authPage">
      <section className="authCard paywallCard card">
        <div className="logo big"><Lock size={30} /></div>
        <span className="pill mini"><Shield size={14} /> FREE ACCOUNT</span>
        <h1>Upgrade ke Premium</h1>
        <p>Akun kamu sudah login. Aktifkan premium untuk membuka dashboard signal.</p>

        <div className="paywallUser">
          <b>{user?.email}</b>
          <span>UID: {user?.uid}</span>
          <span>Role: {(profile?.role || "free").toUpperCase()}</span>
          <span>Premium until: {profile?.premiumUntil || "-"}</span>
        </div>

        <div className="paywallPackageBox">
          <b>Pilih Paket Premium</b>

          <div className="paywallPackageGrid">
            <button
              type="button"
              className={selectedPackage === "7D" ? "active" : ""}
              onClick={() => setSelectedPackage("7D")}
            >
              <span>7 Day</span>
              <strong>{PACKAGE_7D_PRICE}</strong>
              <small>Akses premium 7 hari</small>
            </button>

            <button
              type="button"
              className={selectedPackage === "30D" ? "active" : ""}
              onClick={() => setSelectedPackage("30D")}
            >
              <span>30 Day</span>
              <strong>{PACKAGE_30D_PRICE}</strong>
              <small>Akses premium 30 hari</small>
            </button>
          </div>

          <p>
            Paket dipilih: <b>{selectedPackageInfo.label}</b> · {selectedPackageInfo.price}.
            Copy info aktivasi lalu kirim ke admin bersama bukti pembayaran.
          </p>
        </div>

        <div className="premiumFeatures">
          <b>Premium unlock:</b>
          <span>✅ Live dashboard XAU AI</span>
          <span>✅ MAIN CALL Alert</span>
          <span>✅ M1 Scalp Radar</span>
          <span>✅ Fresh OB M15</span>
          <span>✅ CALL & SCALP History</span>
          <span>✅ Performance Analytics 7/30 Hari</span>
        </div>

        <div className="paywallPaymentBox">
          <b>Info Aktivasi</b>
          <span>Paket: {selectedPackageInfo.label} · {selectedPackageInfo.price}</span>
          <span>Email: {user?.email || "-"}</span>
          <span>UID: {user?.uid || "-"}</span>
          <p>Setelah pembayaran dikonfirmasi, admin akan mengaktifkan premium sesuai paket.</p>
          {paymentOrderStatus ? <div className="paywallOrderStatus">{paymentOrderStatus}</div> : null}
        </div>

        <div className="paywallActions">
          <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Admin</a>
          <button type="button" onClick={copyActivationInfo}>Copy Info Aktivasi</button>
          <button type="button" onClick={submitPaymentOrder} disabled={isSubmittingOrder || localOrderPending}>
            {isSubmittingOrder ? "Membuat Order..." : localOrderPending ? "Order Pending" : "Konfirmasi Pembayaran"}
          </button>
          <button type="button" onClick={onLogout}>Logout</button>
        </div>

        <p className="miniNote">
          Pilih paket, buat order pending, lalu kirim bukti pembayaran ke admin.
        </p>
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


function BybitTestFeedPanel({ feed, market, mt5LastCandle, onRefresh }) {
  const latest = feed?.latest || null;
  const status = feed?.status || null;
  const cronError = feed?.cronError || null;
  const ticker = latest?.ticker || {};
  const lastCandle = latest?.lastCandle || null;
  const lastPrice = Number(latest?.lastPrice ?? ticker?.lastPrice ?? 0);
  const bid = Number(ticker?.bid1Price ?? 0);
  const ask = Number(ticker?.ask1Price ?? 0);
  const spread = bid > 0 && ask > 0 ? Math.abs(ask - bid) : null;
  const updatedAt = Number(status?.updatedAt || latest?.updatedAt || 0);
  const ageMs = updatedAt ? Date.now() - updatedAt : null;
  const isLive = Boolean(status?.ok) && ageMs !== null && ageMs < 120000;
  const isWaiting = !latest && !status;
  const tone = isLive ? "buy" : isWaiting ? "wait" : "sell";
  const label = isLive ? "LIVE" : isWaiting ? "WAITING" : "STALE";
  const mt5Bid = Number(market?.bid || 0);
  const mt5Ask = Number(market?.ask || 0);
  const mt5LastClose = Number(market?.lastClose || mt5LastCandle?.close || mt5Bid || 0);
  const bybitClose = Number(lastCandle?.close || lastPrice || 0);
  const diff = mt5LastClose > 0 && bybitClose > 0 ? bybitClose - mt5LastClose : null;
  const diffAbs = diff === null ? null : Math.abs(diff);
  const diffPct = diff !== null && mt5LastClose > 0 ? (diff / mt5LastClose) * 100 : null;
  const compareTone = diffAbs === null ? "wait" : diffAbs <= 1.5 ? "buy" : diffAbs <= 5 ? "wait" : "sell";
  const compareLabel = diffAbs === null ? "WAITING" : diffAbs <= 1.5 ? "DEKAT" : diffAbs <= 5 ? "SELISIH" : "JAUH";
  const guardState = String(status?.guard || latest?.guard?.state || (latest?.guard?.ok ? "passed" : "") || "-").toUpperCase();
  const guardOk = status?.guard === "passed" || latest?.guard?.ok === true;
  const errorOk = cronError?.ok !== false;
  const errorMessage = cronError?.message || (errorOk ? "No active error" : "-");
  const errorDetails = cronError?.details ? JSON.stringify(cronError.details) : "";
  const errorTone = guardOk && errorOk ? "buy" : "sell";
  const rateLimit = latest?.rateLimit || status?.rateLimit || {};
  const safeCron = status?.safeCron || {};
  const cooldownLeft = Number(status?.cooldownLeftSeconds || cronError?.cooldownLeftSeconds || 0);
  const latestAgeSeconds = status?.latestAgeSeconds ?? (ageMs === null ? null : Math.max(0, Math.round(ageMs / 1000)));
  const safeState = status?.state || (isLive ? "live" : label.toLowerCase());
  const safeMessage = status?.message || "Menunggu status engine.";
  const tickerRate = rateLimit?.ticker || {};
  const klineRate = rateLimit?.kline || {};

  return (
    <section className={`bybitTestPanel card ${tone}`}>
      <div className="strategyHeader">
        <div>
          <span className="pill mini"><Database size={14} /> BACKUP MARKET ENGINE · READ ONLY</span>
          <h3>Premium Backup Market Stream</h3>
          <p className="bybitTestSubtitle">
            Panel ini memantau koneksi market cadangan. Signal utama, chart utama, dan notifikasi premium tetap berjalan seperti biasa.
          </p>
        </div>
        <div className={`biasBadge ${tone}`}>{label}</div>
      </div>

      <div className="bybitTestGrid">
        <Metric label="Last Price" value={formatBybitNumber(lastPrice)} note={latest?.market || latest?.symbol || "XAUUSDT"} />
        <Metric label="Bid / Ask" value={`${formatBybitNumber(bid)} / ${formatBybitNumber(ask)}`} note={`Spread ${spread === null ? "-" : formatBybitNumber(spread, 3)}`} />
        <Metric label="Last Candle M1" value={formatBybitNumber(lastCandle?.close)} note={lastCandle?.time || "Menunggu candle"} />
        <Metric label="Candle Count" value={status?.candleCount ?? "-"} note={`HTTP ${status?.tickerHttpStatus || "-"} / ${status?.klineHttpStatus || "-"}`} />
        <Metric label="Last Update" value={status?.updatedAtText || latest?.updatedAtText || "-"} note={ageMs === null ? "Belum ada update" : `${Math.max(0, Math.round(ageMs / 1000))} detik lalu`} />
        <Metric label="Feed Engine" value="Premium Market Bridge" note="Live backup stream" />
      </div>

      <div className={`bybitGuardBox ${errorTone}`}>
        <div>
          <span className="pill mini">ENGINE GUARD · STEP {status?.step || latest?.step || cronError?.step || "10E"}</span>
          <h4>Guard & Error Monitor</h4>
          <p>Monitor ini hanya untuk admin. Fungsinya mengecek apakah live market bridge berjalan stabil atau butuh perhatian.</p>
        </div>
        <div className="bybitGuardGrid">
          <Metric label="Guard" value={guardState} note={guardOk ? "Data lolos validasi" : "Cek error detail"} />
          <Metric label="Error" value={errorMessage} note={cronError?.updatedAtText || "Belum ada error log"} />
          <Metric label="Spread Guard" value={spread === null ? "-" : formatBybitNumber(spread, 3)} note={`Max ${latest?.guard?.maxAllowedSpread ?? 10}`} />
          <Metric label="Valid Price Range" value={`${latest?.guard?.minValidPrice ?? 1000} - ${latest?.guard?.maxValidPrice ?? 10000}`} note={`Last ${formatBybitNumber(lastPrice)}`} />
        </div>
        {errorDetails && <pre className="bybitErrorDetails">{errorDetails}</pre>}
      </div>

      <div className={`bybitCompareBox ${compareTone}`}>
        <div>
          <span className="pill mini">BROKER FEED CHECK · ADMIN</span>
          <h4>Perbandingan harga sementara</h4>
          <p>Ini hanya alat bantu admin untuk cek selisih. Belum dipakai signal, chart, atau Telegram.</p>
        </div>
        <div className="bybitCompareGrid">
          <Metric label="Primary Feed" value={formatBybitNumber(mt5LastClose)} note={market?.lastCandleTime || mt5LastCandle?.time || market?.receivedAt || "Menunggu feed utama"} />
          <Metric label="Backup Feed" value={formatBybitNumber(bybitClose)} note={lastCandle?.time || latest?.updatedAtText || "Menunggu backup feed"} />
          <Metric label="Selisih" value={diff === null ? "-" : `${diff > 0 ? "+" : ""}${formatBybitNumber(diff)} (${formatSignedPercent(diffPct)})`} note={`Status: ${compareLabel}`} />
          <Metric label="Primary Bid / Ask" value={`${formatBybitNumber(mt5Bid)} / ${formatBybitNumber(mt5Ask)}`} note={market?.symbol || "XAUUSD"} />
        </div>
      </div>

      <div className={`bybitGuardBox ${cooldownLeft > 0 ? "wait" : errorTone}`}>
        <div>
          <span className="pill mini">SAFE MARKET BRIDGE · STEP {status?.step || latest?.step || cronError?.step || "10G"}</span>
          <h4>Safe Cron Status</h4>
          <p>{safeMessage}</p>
        </div>
        <div className="bybitGuardGrid">
          <Metric label="Bridge State" value={safeState} note={cooldownLeft > 0 ? `Cooling down ${cooldownLeft}s` : "Stable 1-minute sync"} />
          <Metric label="Latest Age" value={latestAgeSeconds === null ? "-" : `${latestAgeSeconds}s`} note={`Fresh guard ${safeCron?.freshDataSeconds ?? 50}s`} />
          <Metric label="Min Run Gap" value={`${safeCron?.minRunGapSeconds ?? 45}s`} note={`Request gap ${safeCron?.requestGapMs ?? rateLimit?.requestGapMs ?? 750}ms`} />
          <Metric label="Request Count" value={rateLimit?.requestCount ?? "-"} note="Ticker + Kline, berurutan" />
          <Metric label="Price Stream Health" value={tickerRate?.status ?? tickerRate?.limit ?? "-"} note={tickerRate?.resetTimestamp ? `Reset ${tickerRate.resetTimestamp}` : "Monitoring active"} />
          <Metric label="Candle Stream Health" value={klineRate?.status ?? klineRate?.limit ?? "-"} note={klineRate?.resetTimestamp ? `Reset ${klineRate.resetTimestamp}` : "Monitoring active"} />
        </div>
      </div>

      {feed?.error && <div className="bybitFeedError">{feed.error}</div>}

      <div className="bybitTestActions">
        <button type="button" onClick={onRefresh} disabled={feed?.loading}>
          <RefreshCcw size={15} /> {feed?.loading ? "Loading..." : "Refresh Backup Feed"}
        </button>
        <a href="https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt/status.json" target="_blank" rel="noreferrer">
          Cek status engine
        </a>
        <a href="https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt/error.json" target="_blank" rel="noreferrer">
          Cek catatan error
        </a>
        <a href="https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt/latest.json" target="_blank" rel="noreferrer">
          Cek data terbaru
        </a>
      </div>
    </section>
  );
}

function formatBybitNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "-";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatSignedPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num > 0 ? "+" : ""}${num.toFixed(3)}%`;
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

function SnapshotRow({ row, defaultOpen = false }) {
  return (
    <details className="snapshotRow" open={defaultOpen}>
      <summary>
        <span className="snapshotRowTitle">{row.title}</span>
        <span className="snapshotRowValue" title={String(row.value || "-")}>{row.value || "-"}</span>
        <span className="snapshotRowStatus">{row.status || "WAIT"}</span>
      </summary>
      <div className="snapshotRowBody">
        <p>{row.note || "Menunggu data."}</p>
        <small>{row.detail}</small>
      </div>
    </details>
  );
}
function humanize(value) { if (!value) return "-"; return String(value).replaceAll("_", " "); }
function formatAiText(text) { return String(text).split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>); }
