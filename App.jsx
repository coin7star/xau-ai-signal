import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from "firebase/auth";
const ADMIN_CONTACT_URL = "https://t.me/xauai_signal_bot";
const ADMIN_CONTACT_LABEL = "Hubungi Support";
const PRODUCT_NAME = "XAU AI Signal";
const DASHBOARD_LIVE_REFRESH_MS = 5000;
const DASHBOARD_STALE_REFRESH_MS = 30000;
const CHART_REFRESH_MS = 60000;
const HISTORY_REFRESH_MS = 60000;
const CRON_HEALTH_REFRESH_MS = 60000;

const PAYMENT_QRIS_URL = "";
const PAYMENT_DANA = "08xxxxxxxxxx";
const PAYMENT_OVO = "08xxxxxxxxxx";
const PAYMENT_BANK = "BCA / BRI / Mandiri - hubungi support";
const PACKAGE_7D_PRICE = "Rp10K";
const PACKAGE_30D_PRICE = "Rp30K";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Activity, BarChart3, Bot, Clock, Copy, Database, Lock, LogOut, Radio, RefreshCcw, Settings, Shield, Sparkles, Target, TrendingDown, TrendingUp, User, Zap } from "lucide-react";
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

class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Dashboard perlu dimuat ulang." };
  }

  componentDidCatch(error) {
    console.error("Dashboard safe mode:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page compactDashboardPage">
          <section className="card mt5PauseBanner reconnecting">
            <div>
              <span className="pill mini">SAFE MODE</span>
              <h3>Dashboard butuh dimuat ulang</h3>
              <p>Data market sedang tersambung ulang. Sistem menahan tampilan agar halaman tidak blank.</p>
              <small>{this.state.message}</small>
            </div>
            <button type="button" onClick={() => window.location.reload()}>Muat Ulang</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function AppInner() {
  if (window.location.pathname === "/auth-action") {
    return <FirebaseAuthActionPage auth={auth} />;
  }

  const chartM1Ref = useRef(null);
  const chartM15Ref = useRef(null);
  const chartM1BoxRef = useRef(null);
  const chartM15BoxRef = useRef(null);
  const chartM1ResizeObserverRef = useRef(null);
  const chartM15ResizeObserverRef = useRef(null);
  const seriesM1Ref = useRef(null);
  const seriesM15Ref = useRef(null);

  const ema9M1Ref = useRef(null);
  const ema20M1Ref = useRef(null);
  const ema9M15Ref = useRef(null);
  const ema20M15Ref = useRef(null);

  const obLinesM1Ref = useRef([]);
  const obLinesM15Ref = useRef([]);
  const srLinesM1Ref = useRef([]);
  const planLinesM1Ref = useRef([]);

  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [callHistory, setCallHistory] = useState({ stats: null, history: [] });
  const [scalpHistory, setScalpHistory] = useState({ stats: null, history: [] });
  const [strategyBHistory, setStrategyBHistory] = useState({ stats: null, history: [] });
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
  const [resultTracker, setResultTracker] = useState({ loading: false, message: "", lastRun: null, updated: [] });
  const [cronHealth, setCronHealth] = useState({ loading: false, data: null, error: "" });

  async function loadData({ includeChart = false, includeHistory = false, includeScalpHistory = false } = {}) {
    try {
      setLoading(true);

      const marketPromise = fetch(`/api/market?mode=${includeChart ? "chart&m1=60&m15=0" : "lite"}&ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
      const signalPromise = fetch(`/api/signal?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
      const aiPromise = fetch(`/api/ai-analysis?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
      const historyPromise = includeHistory
        ? fetch(`/api/call-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] }))
        : Promise.resolve(null);
      const scalpHistoryPromise = includeScalpHistory
        ? fetch(`/api/scalp-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] }))
        : Promise.resolve(null);
      const strategyBHistoryPromise = includeScalpHistory
        ? fetch(`/api/strategy-b-history?ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ stats: null, history: [] }))
        : Promise.resolve(null);

      const [marketJson, signalJson, aiJson, historyJson, scalpHistoryJson, strategyBHistoryJson] = await Promise.all([
        marketPromise,
        signalPromise,
        aiPromise,
        historyPromise,
        scalpHistoryPromise,
        strategyBHistoryPromise
      ]);

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

      if (includeScalpHistory && strategyBHistoryJson) {
        setStrategyBHistory(strategyBHistoryJson);
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

    resetChart("M1");
    resetChart("M15");

    setTimeout(() => {
      initChart("M1");
      syncChartData();
    }, 180);
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

  async function loadStrategyBHistoryData() {
    return loadData({ includeChart: false, includeScalpHistory: true });
  }


  async function loadCronHealth() {
    setCronHealth((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const res = await fetch(`/api/result-cron-status?ts=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();

      if (!json.ok) {
        setCronHealth({ loading: false, data: null, error: json.error || "Gagal membaca status cron." });
        return;
      }

      setCronHealth({ loading: false, data: json, error: "" });
    } catch (error) {
      setCronHealth({ loading: false, data: null, error: error?.message || "Gagal membaca status cron." });
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

      await loadHistoryData();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  async function resetAnalytics(kind) {
    if (!adminToken) {
      alert("Isi ADMIN_ACTION_TOKEN dulu.");
      return;
    }

    const label = kind === "all" ? "semua analisis" : "analisis Limit Pullback";
    const ok = window.confirm(`Reset ${label} mulai dari sekarang? History trade tidak dihapus.`);
    if (!ok) return;

    try {
      const res = await fetch("/api/analytics-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ kind, token: adminToken })
      });

      const json = await res.json();
      if (!json.ok) {
        alert(json.error || "Gagal reset analisis");
        return;
      }

      alert(json.message || "Analisis berhasil direset.");
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


  async function updateStrategyBResult(id, result) {
    if (!id) return;

    try {
      const res = await fetch("/api/strategy-b-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ id, result, token: adminToken })
      });

      const json = await res.json();

      if (!json.ok) {
        alert(json.error || "Gagal update SMC AI result");
        return;
      }

      await loadStrategyBHistoryData();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  async function runAutoResultTracker() {
    if (!adminToken) {
      alert("Isi Kode admin dulu sebelum menjalankan Auto Result Engine.");
      return;
    }

    try {
      setResultTracker((prev) => ({ ...prev, loading: true, message: "Mengecek sinyal berjalan..." }));

      const res = await fetch("/api/result-tracker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ token: adminToken })
      });
      const json = await res.json();

      if (!json.ok) {
        setResultTracker((prev) => ({ ...prev, loading: false, message: json.error || "Auto Result Engine gagal dijalankan." }));
        alert(json.error || "Auto Result Engine gagal dijalankan.");
        return;
      }

      setResultTracker({
        loading: false,
        message: json.message || "Auto Result Engine selesai mengecek signal.",
        lastRun: json.checkedAt || new Date().toISOString(),
        updated: json.updated || [],
        updatedCount: json.updatedCount || 0,
        scanned: json.scanned || 0,
        livePrice: json.livePrice || 0
      });

      await loadData({ includeChart: false, includeHistory: true, includeScalpHistory: true });
      await loadCronHealth();
    } catch (err) {
      setResultTracker((prev) => ({ ...prev, loading: false, message: err?.message || String(err) }));
      alert(err?.message || String(err));
    }
  }

  function saveAdminToken(value) {
    setAdminToken(value);
    localStorage.setItem("xau_admin_token", value);
  }

  const mt5Status = getMt5Status(market);
  const candleSync = signal?.candleSync || signal?.strategy?.mainM5?.candleSync || market?.candleSync || null;
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

    // RTDB Lite Mode:
    // Live refresh utama jalan tiap 5 detik saat feed sehat. Kalau MT5/VPS stale, refresh diperlambat supaya RTDB aman.
    // Chart hanya refresh 60 detik dan history 60 detik agar download Firebase tidak cepat habis.
    const liteInterval = setInterval(loadLiteData, shouldPauseHeavyRefresh ? DASHBOARD_STALE_REFRESH_MS : DASHBOARD_LIVE_REFRESH_MS);

    let chartInterval = null;
    let historyInterval = null;
    let scalpHistoryInterval = null;

    if (!shouldPauseHeavyRefresh) {
      chartInterval = setInterval(loadChartData, CHART_REFRESH_MS);
      historyInterval = setInterval(loadHistoryData, HISTORY_REFRESH_MS);
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


  useEffect(() => {
    if (!authUser || !isPremiumProfile(authProfile)) return;

    loadCronHealth();
    const interval = setInterval(loadCronHealth, CRON_HEALTH_REFRESH_MS);

    return () => clearInterval(interval);
  }, [authUser, authProfile?.role, authProfile?.premiumUntil]);

  const candlesM1 = Array.isArray(market?.candles) ? market.candles : [];
  const candlesM5 = Array.isArray(market?.candlesM5) ? market.candlesM5 : [];
  const candlesM15 = Array.isArray(market?.candlesM15) ? market.candlesM15 : [];
  const tvM1 = useMemo(() => candlesToTradingView(candlesM1), [candlesM1]);
  const tvM15 = useMemo(() => candlesToTradingView(candlesM15), [candlesM15]);
  const lastCandle = candlesM1[candlesM1.length - 1];
  const marketSession = getMarketSessionStatus({
    market,
    mt5Status,
    m1Count: tvM1.length || market?.m1Count || market?.candles?.length || 0,
    m15Count: tvM15.length || market?.m15Count || 0
  });

  const isBuy = signal?.signal === "BUY";
  const isSell = signal?.signal === "SELL";
  const isReady = signal?.callStage === "READY";
  const spread = market?.ask && market?.bid ? Math.abs(Number(market.ask) - Number(market.bid)).toFixed(2) : "-";

  useEffect(() => {
    if (!authUser || !isPremiumProfile(authProfile) || activeDashboardTab !== "chart") return;

    // Chart memakai canvas teknis. Saat tab Candle ditutup, DOM chart ikut hilang,
    // jadi instance lama harus dibersihkan dan dibuat ulang saat tab dibuka lagi.
    resetChart("M1");
    resetChart("M15");

    const timer = setTimeout(() => {
      initChart("M1");
      syncChartData();
    }, 180);

    return () => {
      clearTimeout(timer);
      resetChart("M1");
      resetChart("M15");
    };
  }, [authUser, authProfile?.role, authProfile?.premiumUntil, activeDashboardTab]);

  useEffect(() => {
    if (!authUser || !isPremiumProfile(authProfile) || activeDashboardTab !== "chart") return;
    initChart("M1");
    syncChartData();
  }, [tvM1, tvM15, activeDashboardTab]);

  useEffect(() => {
    try {
      if (ema9M1Ref.current && ema20M1Ref.current && tvM1.length > 0) {
        ema9M1Ref.current.setData(buildEMAData(tvM1, 9));
        ema20M1Ref.current.setData(buildEMAData(tvM1, 20));
      }
    } catch (error) {
      setChartError(error?.message || "EMA M1 sedang disiapkan ulang.");
    }
  }, [tvM1]);

  useEffect(() => {
    try {
      if (ema9M15Ref.current && ema20M15Ref.current && tvM15.length > 0) {
        ema9M15Ref.current.setData(buildEMAData(tvM15, 9));
        ema20M15Ref.current.setData(buildEMAData(tvM15, 20));
      }
    } catch {}
  }, [tvM15]);

  useEffect(() => {
    try {
      clearObLines(obLinesM1Ref);
      clearObLines(obLinesM15Ref);
      if (seriesM1Ref.current) addTradePlanLines(seriesM1Ref.current, planLinesM1Ref, signal?.strategy?.mainM5);
    } catch (error) {
      setChartError(error?.message || "Garis entry sedang disiapkan ulang.");
    }
  }, [signal?.strategy?.mainM5?.entry, signal?.strategy?.mainM5?.sl, signal?.strategy?.mainM5?.tp, signal?.strategy?.mainM5?.action]);

  useEffect(() => {
    try {
      if (seriesM1Ref.current) {
        // Step 10AR1: Swing structure lines are hidden from user chart to keep M5 view clean.
      }
    } catch (error) {
      setChartError(error?.message || "Garis struktur M1 sedang disiapkan ulang.");
    }
  }, [
    signal?.strategy?.scalping?.support,
    signal?.strategy?.scalping?.resistance,
    signal?.strategy?.scalping?.supportTouches,
    signal?.strategy?.scalping?.resistanceTouches
  ]);

  function resetChart(type) {
    const chartRef = type === "M1" ? chartM1Ref : chartM15Ref;
    const seriesRef = type === "M1" ? seriesM1Ref : seriesM15Ref;
    const resizeObserverRef = type === "M1" ? chartM1ResizeObserverRef : chartM15ResizeObserverRef;

    try {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    } catch {}
    resizeObserverRef.current = null;

    try {
      if (type === "M1") {
        clearStructureLines(srLinesM1Ref);
        clearObLines(obLinesM1Ref);
        clearTradePlanLines(planLinesM1Ref);
      } else {
        clearObLines(obLinesM15Ref);
      }
    } catch {}

    try {
      if (chartRef.current) chartRef.current.remove();
    } catch {}

    chartRef.current = null;
    seriesRef.current = null;

    if (type === "M1") {
      ema9M1Ref.current = null;
      ema20M1Ref.current = null;
    } else {
      ema9M15Ref.current = null;
      ema20M15Ref.current = null;
    }
  }

  function syncChartData() {
    try {
      updateChart(seriesM1Ref.current, chartM1Ref.current, tvM1);
      updateChart(seriesM15Ref.current, chartM15Ref.current, tvM15);
    } catch (error) {
      setChartError(error?.message || "Grafik sedang disiapkan ulang.");
      return;
    }

    try {
      if (ema9M1Ref.current && ema20M1Ref.current && tvM1.length > 0) {
        ema9M1Ref.current.setData(buildEMAData(tvM1, 9));
        ema20M1Ref.current.setData(buildEMAData(tvM1, 20));
      }

      if (ema9M15Ref.current && ema20M15Ref.current && tvM15.length > 0) {
        ema9M15Ref.current.setData(buildEMAData(tvM15, 9));
        ema20M15Ref.current.setData(buildEMAData(tvM15, 20));
      }
    } catch (error) {
      setChartError(error?.message || "EMA chart sedang disiapkan ulang.");
    }

    if (seriesM1Ref.current) {
      try {
        clearObLines(obLinesM1Ref);
      // Step 10AR1: hide M5 swing high/low lines; strategy logic still runs in backend.
        addTradePlanLines(seriesM1Ref.current, planLinesM1Ref, signal?.strategy?.mainM5);
      } catch (error) {
        setChartError(error?.message || "Garis chart sedang disiapkan ulang.");
      }
    }

    try {
      clearObLines(obLinesM15Ref);
    } catch {}
  }

  function initChart(type) {
    const boxRef = type === "M1" ? chartM1BoxRef : chartM15BoxRef;
    const chartRef = type === "M1" ? chartM1Ref : chartM15Ref;
    const seriesRef = type === "M1" ? seriesM1Ref : seriesM15Ref;
    if (!boxRef.current || chartRef.current) return;

    const containerWidth = Math.floor(boxRef.current.getBoundingClientRect().width || boxRef.current.clientWidth || 0);
    if (containerWidth < 40) return;

    try {
      const chart = createChart(boxRef.current, {
        width: containerWidth,
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
        const nextWidth = Math.floor(boxRef.current.getBoundingClientRect().width || boxRef.current.clientWidth || 0);
        if (nextWidth > 40) chartRef.current.applyOptions({ width: nextWidth });
      });
      resizeObserver.observe(boxRef.current);
      const resizeObserverRef = type === "M1" ? chartM1ResizeObserverRef : chartM15ResizeObserverRef;
      resizeObserverRef.current = resizeObserver;
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
  const qualityGuard = signal?.qualityGuard || signal?.strategy?.qualityGuard || null;
  const readableSignal = signal?.signalLabel || signal?.signal || "Menunggu";
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
  const mainM5 = signal?.strategy?.mainM5 || {
    action: "Menunggu",
    label: "Main Signal Menunggu",
    direction: "Menunggu",
    entry: 0,
    sl: 0,
    tp: 0,
    ema9: 0,
    ema20: 0,
    cross: { type: "NONE", time: null },
    correction: { touchedEma9: false, buffer: 0 },
    confidence: signal?.confidence || 0,
    blocker: "Menunggu setup M1 EMA cross direct.",
    checklist: [],
    sourceTimeframe: "MT5_VPS_M1",
    maxBuyPending: 2,
    maxSellPending: 2
  };
  const scalping = signal?.strategy?.scalping || {
    label: "SCALP Menunggu",
    confidence: 0,
    action: "Menunggu",
    entry: "-",
    sl: "-",
    tp: "-",
    reason: "Menunggu data M1."
  };
  const strategyB = signal?.strategyB || signal?.strategy?.strategyB || {
    name: "SMC AI",
    mode: "LIVE_BACKTEST_ONLY",
    action: "Menunggu",
    label: "SMC AI Menunggu",
    direction: "Menunggu",
    confidence: 0,
    entry: "-",
    sl: "-",
    tp: "-",
    rr: "1:2",
    reason: "Menunggu data Strategi B.",
    checklist: [],
    blockers: [],
    indicators: {}
  };
  const emaTrendSide = Number(mainM5.ema9 || 0) > Number(mainM5.ema20 || 0)
    ? "Bullish"
    : Number(mainM5.ema9 || 0) < Number(mainM5.ema20 || 0)
      ? "Bearish"
      : "Netral";
  const actionDisplay = formatPremiumAction(mainM5.action);
  const setupLabel = formatPremiumStrength(probability.label, probability.score);
  const closeFilterValid = Boolean(mainM5.correction?.touchedEma9 && mainM5.cross?.type?.includes("CROSS"));
  const hasEntryPlan = Boolean(mainM5.entry && mainM5.sl && (mainM5.tp2 || mainM5.tp));
  const pullbackPlan = mainM5.pullbackLimitPlan || signal?.pullbackLimitPlan || {};
  const hasPullbackLimit = Boolean(pullbackPlan?.enabled && pullbackPlan?.limitEntry);
  const entryPlanText = hasEntryPlan
    ? `${mainM5.direction} agresif ${mainM5.entry}${hasPullbackLimit ? ` · Limit ${pullbackPlan.limitEntry}` : ""}`
    : "Belum ada entry";
  const riskPlanText = hasEntryPlan
    ? `SL ${mainM5.sl} · TP1 ${mainM5.tp1 || "-"} · Max ${mainM5.tp2 || mainM5.tp}`
    : "Belum tersedia";
  const checklistText = (mainM5.checklist || [])
    .slice(0, 4)
    .map((item) => `${item.name}: ${formatPremiumChecklistStatus(item.status)}`)
    .join(" · ");

  const snapshotRows = [
    {
      id: "ema",
      title: "Arah EMA M1",
      value: emaTrendSide,
      status: "Market saat ini",
      note: `EMA9 ${mainM5.ema9 || "-"} · EMA20 ${mainM5.ema20 || "-"}. ${emaTrendSide === "Bullish" ? "EMA cepat berada di atas EMA utama." : emaTrendSide === "Bearish" ? "EMA cepat masih berada di bawah EMA utama." : "EMA9 dan EMA20 masih sangat rapat."}`,
      detail: "Bagian ini hanya membaca posisi EMA saat ini. Sinyal baru tetap harus menunggu EMA9 benar-benar cross EMA20 setelah candle M1 selesai."
    },
    {
      id: "pullback",
      title: "Validasi Candle Close",
      value: closeFilterValid ? "Sudah valid" : "Belum valid",
      status: closeFilterValid ? "Lolos" : "Menunggu",
      note: closeFilterValid ? "Candle M1 sudah close di sisi EMA yang sesuai dengan arah cross." : "Belum ada candle M1 close yang memenuhi syarat sinyal baru.",
      detail: "BUY hanya valid jika setelah bullish cross candle close di atas EMA9/EMA20. SELL hanya valid jika setelah bearish cross candle close di bawah EMA9/EMA20."
    },
    {
      id: "entry",
      title: "Status Entry",
      value: entryPlanText,
      status: actionDisplay,
      note: hasEntryPlan ? (hasPullbackLimit ? `Entry agresif aktif. Opsi limit pullback di area ${pullbackPlan.zoneLow} - ${pullbackPlan.zoneHigh}.` : mainM5.reason || "Sinyal premium aktif.") : mainM5.blocker || "Sistem masih menunggu cross EMA M1 yang benar-benar valid.",
      detail: "Entry agresif mengikuti cross. Jika harga sudah keburu jalan, gunakan area limit pullback EMA dan jangan kejar harga."
    },
    {
      id: "risk",
      title: "Target & Risiko",
      value: riskPlanText,
      status: hasEntryPlan ? "Siap dipantau" : "Menunggu entry",
      note: hasEntryPlan ? "TP1 berada di tengah target. Jika TP1 tersentuh, posisi diamankan ke BE. SL/TP tetap mengikuti plan utama." : "Target dan batas risiko baru muncul setelah sinyal entry aktif.",
      detail: "SL dan TP utama tetap sama untuk entry agresif dan opsi limit pullback. Limit hanya membantu user manual agar tidak mengejar harga."
    },
    {
      id: "probability",
      title: "Kekuatan Setup",
      value: `${probability.score || 0}% · ${setupLabel}`,
      status: setupLabel,
      note: checklistText || "Menunggu checklist setup lengkap.",
      detail: "Skor ini membantu membaca kualitas setup. Skor rendah berarti sistem masih menunggu konfirmasi utama, bukan sinyal entry."
    },
    {
      id: "main-rule",
      title: "Rule Aktif",
      value: hasEntryPlan ? `${mainM5.direction} Direct Entry` : "Menunggu sinyal baru",
      status: "EMA Cross M1",
      note: hasEntryPlan ? "Sinyal premium aktif memakai satu rule utama." : "Belum ada open signal. Sistem hanya akan aktif saat EMA9 cross EMA20 dan candle M1 close valid.",
      detail: "Rule aktif saat ini hanya M1 EMA Cross Direct Entry. SMC AI, Scalp, dan rule M5 tidak dipakai untuk sinyal utama."
    }
  ];
  const historyStats = callHistory?.stats || {};
  const scalpStats = scalpHistory?.stats || {};
  const telegramStatus = formatSignalAlertStatus(signal?.telegram);
  const premiumActive = isPremiumProfile(authProfile);
  const roleLabel = getRoleBadgeLabel(authProfile);
  const isAdmin = authProfile?.role === "admin";
  const premiumInfo = getPremiumInfo(authProfile);
  const emailVerified = Boolean(authUser?.emailVerified || authProfile?.emailVerified || authProfile?.emailCodeVerified);

  if (authLoading) {
    return (
      <main className="page authPage">
        <section className="authCard card">
          <div className="logo big"><Shield size={28} /></div>
          <h1>Loading XAU AI...</h1>
          <p>Sebentar ya, kami sedang menyiapkan akses premium kamu.</p>
        </section>
      </main>
    );
  }

  if (!hasFirebaseClientConfig) {
    return (
      <main className="page authPage">
        <section className="authCard card">
          <div className="logo big"><Shield size={28} /></div>
          <h1>Akses premium belum siap</h1>
          <p>Tim admin perlu mengaktifkan konfigurasi akses terlebih dahulu sebelum dashboard bisa digunakan.</p>
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
    { id: "chart", label: "Chart", icon: <Activity size={15} /> },
    { id: "history", label: "Riwayat", icon: <Clock size={15} /> },
    { id: "telegram", label: "Telegram", icon: <Radio size={15} /> },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: <Settings size={15} /> }] : [])
  ];

  return (
    <main className="page compactDashboardPage">
      <header className="nav dashboardHeader">
        <div className="brand dashboardBrand">
          <div className="logo dashboardLogo"><Bot size={22} /></div>
          <div className="dashboardBrandText">
            <b>XAU AI Signal</b>
            <span>Member Area · Sinyal Gold M1 · Chart · Riwayat</span>
          </div>
        </div>
        <div className="navActions dashboardHeaderActions">
          <div className={`live headerBadge headerFeedBadge ${marketSession.type !== "online" ? "stale" : ""}`}><Radio size={14} /> {marketSession.navLabel}</div>
          <div className="live headerBadge headerAlertBadge"><Radio size={14} /> {telegramStatus}</div>
          <div className="accountBadge headerBadge headerRoleBadge"><User size={15} /> {roleLabel}</div>
          <div className={`premiumExpiryBadge headerBadge headerAccessBadge ${premiumInfo.expired ? "expired" : ""}`}>
            <Shield size={15} /> {premiumInfo.label}
          </div>
          <button className="navBtn danger headerBadge headerLogoutBtn" type="button" onClick={logout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {mt5Status.isStale && (
        <section className={`mt5PauseBanner card ${marketSession.type}`}>
          <div>
            <span className="pill mini">{marketSession.pill}</span>
            <h3>{marketSession.title}</h3>
            <p>{marketSession.description}</p>
          </div>
          <button type="button" onClick={() => loadData({ includeChart: true, includeHistory: true, includeScalpHistory: true })}>
            {marketSession.buttonLabel}
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
          <RefreshCcw size={15} /> {loading ? "Memuat..." : "Refresh Manual"}
        </button>
      </section>

      <div className="dataTickerBar slimTicker">
        <div className="tickerTrack">
          <span><Database size={14} /> Data Market: <b>Live Premium</b></span>
          <span><Activity size={14} /> Grafik M1: <b>{candlesM1.length || market?.m1Count || 0} candle</b></span>
          <span>{isSell ? <TrendingDown size={14} /> : <TrendingUp size={14} />} Harga Sekarang: <b>{lastCandle?.close || "-"}</b></span>
          <span><Radio size={14} /> Status Data: <b>{marketSession.feedLabel}</b></span>
          <span><Clock size={14} /> Candle Close M1: <b>{formatCandleSyncLabel(candleSync)}</b></span>
          <span><RefreshCcw size={14} /> Mode Hemat RTDB: <b>{shouldPauseHeavyRefresh ? "30 detik" : "5 detik"}</b></span>
        </div>
      </div>

      <div className="liteModeNotice">
        <b>Mode Hemat RTDB aktif</b> · Harga & sinyal refresh 5 detik, chart 60 detik, history 60 detik. Sinyal M1 memakai candle yang sudah close dari MT5, sedangkan TP/SL/BE tetap membaca latest price.
      </div>

      {activeDashboardTab === "signal" && (
        <>
          <SignalQualityGuardPanel guard={qualityGuard} />

          <section className="hero cleanHero compactHero">
            <div className={`signalBox card ${signalTone}`}>
              <div className="signalTop"><b>{market?.symbol || "XAUUSD"}</b><span>{lastUpdate}</span></div>
              <h2>{readableSignal}</h2>
              <div className="confidence">{signal?.confidence || 0}% kekuatan setup</div>
              {signal?.reasonDetails?.checklist?.length > 0 && (
                <div className="reasonBuilderBox">
                  <div className="reasonBuilderTitle"><Sparkles size={14} /> Kenapa Sinyal Ini Muncul</div>
                  <ul>
                    {signal.reasonDetails.checklist.slice(0, 5).map((item, idx) => (
                      <li key={`reason-${idx}`}>{formatChecklistText(item)}</li>
                    ))}
                  </ul>
                  {signal.reasonDetails.blockers?.length > 0 && (
                    <div className="reasonBlockers">
                      <b>Menunggu:</b> {signal.reasonDetails.blockers.slice(0, 3).map(formatChecklistText).join(", ")}
                    </div>
                  )}
                </div>
              )}
              <div className="tradePlan">
                <div><small>Harga Masuk</small><strong>{signal?.entry || "-"}</strong></div>
                <div><small>Batas Risiko</small><strong>{signal?.sl || "-"}</strong></div>
                <div><small>Target Profit</small><strong>{signal?.tp1 && signal?.tp2 ? `TP1 ${signal.tp1} / Target Max ${signal.tp2}` : signal?.tp || "-"}</strong></div>
              </div>
            </div>

            <section className="strategyPanel card compactImportantCard">
              <div className="strategyHeader">
                <div><span className="pill mini"><Target size={14} /> RINGKASAN</span><h3>Kondisi Market</h3></div>
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
              <div><h3>Chart Gold M1</h3><span>{market?.symbol || "XAUUSD"} · Sinyal EMA Cross M1 · {marketSession.chartStatusText} · Harga {market?.bid || "-"} · Spread {spread}</span></div>
              <div className="legend">
                <b><i className="bullDot"></i> Bullish</b>
                <b><i className="bearDot"></i> Bearish</b>
                <b><i className="ema9Dot"></i> EMA 9</b>
                <b><i className="ema20Dot"></i> EMA 20</b>
                <b><i className="entryDot"></i> Entry / Limit / Target / Risiko</b>
                <em><span></span> Visual M1 · Entry/Target/Risiko dari EMA Cross M1</em>
              </div>
            </div>
            {marketSession.chartNotice && <div className={`chartSessionNotice ${marketSession.type}`}>{marketSession.chartNotice}</div>}
            {chartError && <div className="chartError">Grafik belum bisa dimuat: {chartError}</div>}
            <div className="tvChart" ref={chartM1BoxRef}>
              {tvM1.length === 0 && <div className="chartEmpty">{marketSession.emptyM1Text}</div>}
            </div>
          </section>


        </>
      )}

      {activeDashboardTab === "scalp" && (
        <>
          <section className={`scalpPanel card ${String(scalping.action || "Menunggu").toLowerCase()}`}>
            <div className="strategyHeader">
              <div>
                <span className="pill mini"><Zap size={14} /> SCALP M5</span>
                <h3>{scalping.label || "SCALP Menunggu"}</h3>
              </div>
              <div className={`biasBadge ${scalping.action === "SCALP_BUY" ? "buy" : scalping.action === "SCALP_SELL" ? "sell" : "wait"}`}>
                {scalping.confidence || 0}% scalp
              </div>
            </div>

            <div className="scalpGrid">
              <Metric label="Scalp Entry" value={scalping.entry || "-"} note="Area acuan saat setup scalp valid" />
              <Metric label="Scalp Risiko" value={scalping.sl || "-"} note="Batas risiko dari area sentuh + 1.5 ATR" />
              <Metric label="Scalp TP" value={scalping.tp || "-"} note="Target cepat rasio 1 : 1.25" />
              <Metric label="Scalp Strength" value={`${scalping.score || 0}/100`} note="Minimal 58/100 untuk peluang scalp valid" />
            </div>

            <p className="scalpReason">{scalping.reason}</p>
            <p className="scalpWarning">Mode scalp membaca struktur M1. BUY mencari pantulan swing low, SELL mencari reject swing high. Sinyal utama tetap menjadi acuan utama.</p>
          </section>


          <section className="historyPanel card scalpHistoryPanel">
            <div className="sectionTitle">
              <div>
                <h3>{isAdmin ? "Riwayat Scalp & Update Manual" : "Performa Scalp M1"}</h3>
                <span>Hanya peluang scalp valid yang ditampilkan agar riwayat tetap bersih.</span>
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
                Pantau performa peluang Scalp M1 yang valid secara ringkas.
              </div>
            )}

            {(scalpHistory?.history || []).length > 8 && (
              <div className="historyScrollNote">
                Semua riwayat scalp ditampilkan. Scroll daftar ini supaya halaman tetap rapi dan tidak terlalu panjang.
              </div>
            )}

            <div className="historyTable mainHistoryScrollTable">
              <div className={`historyHead ${isAdmin ? "adminMode" : "viewerMode"}`}>
                <span>Waktu</span>
                <span>Sinyal</span>
                <span>Harga Masuk</span>
                <span>Risiko / Target</span>
                <span>Score</span>
                <span>Hasil</span>
                {isAdmin && <span>Aksi</span>}
              </div>

              {(scalpHistory?.history || []).slice(0, 10).map((item) => (
                <div className={`historyRow ${isAdmin ? "adminMode" : "viewerMode"}`} key={item.id}>
                  <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
                  <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
                  <span>{item.entry}</span>
                  <span>{item.sl || "-"} / {item.tp || "-"}</span>
                  <span>{item.score ?? item.confidence ?? "-"}%</span>
                  <span className={`resultBadge ${getResultStatusTone(item)}`}>
                    {formatResultStatus(item)}
                  </span>
                  {isAdmin && (
                    <div className="historyActions">
                      <button type="button" onClick={() => updateScalpResult(item.id, "WIN")}>Menang</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "LOSS")}>Kalah</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "BE")}>BE</button>
                      <button type="button" onClick={() => updateScalpResult(item.id, "OPEN")}>Berjalan</button>
                    </div>
                  )}
                </div>
              ))}

              {(!scalpHistory?.history || scalpHistory.history.length === 0) && (
                <div className="emptyHistory">Belum ada peluang Scalp M1 valid. Riwayat akan muncul otomatis saat setup valid.</div>
              )}
            </div>
          </section>
        </>
      )}

      {activeDashboardTab === "smc" && (
        <>
          <StrategyBSmcPanel
            strategyB={strategyB}
            strategyBHistory={strategyBHistory}
            isAdmin={isAdmin}
            onUpdateResult={updateStrategyBResult}
          />
        </>
      )}

      {activeDashboardTab === "history" && (
        <>
          <UserPaymentHistoryCard user={authUser} />
          {isAdmin && (
            <ResultTrackerPrepPanel
              callHistory={callHistory}
              scalpHistory={scalpHistory}
              market={market}
              signal={signal}
              isAdmin={isAdmin}
              adminToken={adminToken}
              trackerState={resultTracker}
              onRunTracker={runAutoResultTracker}
              cronHealth={cronHealth}
              onRefreshCronHealth={loadCronHealth}
            />
          )}
          <PerformanceAnalyticsPanel
            callHistory={callHistory}
            scalpHistory={{ stats: null, history: [] }}
            isAdmin={isAdmin}
            adminToken={adminToken}
            onResetAnalytics={resetAnalytics}
          />

          <section className="historyPanel card">
            <div className="sectionTitle">
              <div>
                <h3>{isAdmin ? "Riwayat Sinyal & Update Manual" : "Riwayat Sinyal Premium"}</h3>
                <span>{isAdmin ? "Sinyal valid tersimpan otomatis. Admin bisa memperbarui hasil manual bila diperlukan." : "Riwayat sinyal premium dan hasil terbarunya."}</span>
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
                Pantau histori sinyal dan performa secara transparan.
              </div>
            )}

            {isAdmin && (
              <div className="adminTokenBox">
                <span>Kode admin untuk update hasil</span>
                <input
                  value={adminToken}
                  onChange={(event) => saveAdminToken(event.target.value)}
                  placeholder="Masukkan kode admin"
                  type="password"
                />
              </div>
            )}

            {(callHistory?.history || []).length > 6 && (
              <div className="historyScrollNote">
                Semua riwayat sinyal ditampilkan. Scroll daftar ini supaya halaman tetap rapi dan tidak terlalu panjang.
              </div>
            )}

            <div className="historyTable mainHistoryScrollTable">
              <div className={`historyHead ${isAdmin ? "adminMode" : "viewerMode"}`}>
                <span>Waktu</span>
                <span>Sinyal</span>
                <span>Harga Masuk</span>
                <span>Risiko / Target</span>
                <span>Kekuatan</span>
                <span>Hasil</span>
                {isAdmin && <span>Aksi</span>}
              </div>

              {(callHistory?.history || []).map((item) => (
                <div className={`historyRow ${isAdmin ? "adminMode" : "viewerMode"}`} key={item.id}>
                  <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
                  <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
                  <span>{item.entry}</span>
                  <span>{formatRiskTargetText(item)}</span>
                  <span>{item.probability?.score ?? item.confidence ?? "-"}%</span>
                  <span className={`resultBadge ${getResultStatusTone(item)}`}>
                    {formatResultStatus(item)}
                  </span>
                  {isAdmin && (
                    <div className="historyActions">
                      <button type="button" onClick={() => updateCallResult(item.id, "WIN")}>Menang</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "LOSS")}>Kalah</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "BE")}>BE</button>
                      <button type="button" onClick={() => updateCallResult(item.id, "OPEN")}>Berjalan</button>
                    </div>
                  )}
                </div>
              ))}

              {(!callHistory?.history || callHistory.history.length === 0) && (
                <div className="emptyHistory">Belum ada sinyal premium yang valid. Riwayat akan muncul otomatis saat ada BUY/SELL.</div>
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
        <section className="adminWindowStack">
          <div className="adminWindowIntro card">
            <span className="pill mini"><Settings size={14} /> ADMIN WORKSPACE</span>
            <h3>Panel Admin</h3>
            <p>Setiap panel dibuat seperti jendela. Klik judul panel untuk buka/tutup detail.</p>
          </div>

          <details className="adminWindow card" open>
            <summary>
              <span>Strategy Control Center</span>
              <small>Master switch untuk Sinyal Utama M1 dan alert result.</small>
            </summary>
            <div className="adminWindowBody">
              <AdminStrategyControlCenter adminToken={adminToken} />
            </div>
          </details>

          <details className="adminWindow card">
            <summary>
              <span>Premium & Payment Management</span>
              <small>User premium, akses admin, Telegram user, dan order pembayaran.</small>
            </summary>
            <div className="adminWindowBody">
              <AdminPanel adminToken={adminToken} setAdminToken={setAdminToken} />
            </div>
          </details>

          <details className="adminWindow card">
            <summary>
              <span>Notifikasi Telegram Test</span>
              <small>Kirim test alert premium dengan akses admin dan cooldown anti-spam.</small>
            </summary>
            <div className="adminWindowBody">
              <AdminTelegramTestPanel adminToken={adminToken} />
            </div>
          </details>

          <details className="adminWindow card">
            <summary>
              <span>Result Alert Test</span>
              <small>Test notifikasi Menang, Kalah, dan Kedaluwarsa tanpa mengubah history asli.</small>
            </summary>
            <div className="adminWindowBody">
              <AdminResultAlertTestPanel adminToken={adminToken} />
            </div>
          </details>

          <details className="adminWindow card">
            <summary>
              <span>Backup Market Engine</span>
              <small>Monitor koneksi market cadangan dan guard status.</small>
            </summary>
            <div className="adminWindowBody">
              <BybitTestFeedPanel feed={bybitFeed} market={market} mt5LastCandle={lastCandle} onRefresh={loadBybitTestFeed} />
            </div>
          </details>

          <details className="adminWindow card">
            <summary>
              <span>Analisa AI Sinkron</span>
              <small>Status analisa AI live/fallback untuk dashboard.</small>
            </summary>
            <div className="adminWindowBody">
              <section className="aiPanel card adminNestedPanel">
                <div className="strategyHeader">
                  <div><span className="pill mini"><Sparkles size={14} /> AI MARKET ANALYSIS</span><h3>Analisa AI sinkron</h3></div>
                  <div className={`biasBadge ${aiAnalysis?.mode === "ai-live" ? "buy" : "wait"}`}>{aiAnalysis?.mode === "ai-live" ? "AI Live" : "Fallback"}</div>
                </div>
                <div className="aiText">{formatAiText(aiAnalysis?.analysis || "Menunggu analisa AI...")}</div>
              </section>
            </div>
          </details>
        </section>
      )}

      <footer>Bukan financial advice. Demo first, XAUUSD galak bro 😭</footer>
    </main>
  );
}


export default function App() {
  return (
    <DashboardErrorBoundary>
      <AppInner />
    </DashboardErrorBoundary>
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


function getRoleBadgeLabel(profile) {
  if (!profile?.role) return "Free";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "premium") return "Premium";
  return "Free";
}

function getPremiumInfo(profile) {
  if (!profile) {
    return {
      label: "Free Plan",
      detail: "Akses premium belum aktif",
      dateText: "-",
      expired: true
    };
  }

  if (profile.role === "admin") {
    return {
      label: "Akses Admin",
      detail: "Hak akses admin aktif tanpa batas waktu",
      dateText: "Lifetime admin",
      expired: false
    };
  }

  const until = profile.premiumUntil || profile.expiredAt || null;

  if (profile.role !== "premium") {
    return {
      label: "Free Plan",
      detail: "Akses premium belum aktif",
      dateText: "-",
      expired: true
    };
  }

  if (!until) {
    return {
      label: "Premium Berakhir",
      detail: "Masa aktif premium belum terdeteksi",
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
      label: "PREMIUM Kedaluwarsa",
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





function formatCandleSyncLabel(sync) {
  if (!sync) return "menunggu";
  const age = sync.closedCandleAgeSec;
  const ageText = Number.isFinite(Number(age)) ? `${Number(age)}d` : "-";
  const status = String(sync.status || "").toUpperCase();
  if (status === "SYNCED") return `sinkron · ${ageText}`;
  if (status === "VALID" || status === "OK") return `valid · ${ageText}`;
  if (status === "STALE_CANDLE") return `telat · ${ageText}`;
  return `menunggu · ${ageText}`;
}

function getMarketSessionStatus({ market, mt5Status, m1Count = 0, m15Count = 0 }) {
  const weekendPause = isForexWeekendPause();
  const hasStoredCandles = Number(m1Count || 0) + Number(m15Count || 0) > 0;
  const lastText = mt5Status?.lastText || "belum ada data";
  const lastPrice = market?.lastClose || market?.bid || market?.ask || "-";

  if (!mt5Status?.isStale) {
    return {
      type: "online",
      navLabel: "Live market online",
      feedLabel: "Online",
      pill: "MARKET LIVE AKTIF",
      title: "Market tersambung",
      description: "Grafik live sedang aktif dan dashboard membaca data terbaru.",
      buttonLabel: "Refresh",
      chartStatusText: "Live session active",
      chartNotice: "",
      emptyM1Text: "Menunggu data live M1...",
      emptyM15Text: "Menunggu data live M15..."
    };
  }

  if (weekendPause) {
    return {
      type: "session-paused",
      navLabel: "Market session paused",
      feedLabel: hasStoredCandles ? "Session Paused" : "Waiting Session",
      pill: "SESI MARKET JEDA",
      title: "Market sedang jeda",
      description: hasStoredCandles
        ? `Sesi XAU/forex sedang tutup. Dashboard tetap menampilkan data terakhir dari ${lastText} agar grafik masih bisa dibaca. Sistem akan aktif otomatis saat market buka kembali.`
        : "Sesi XAU/forex sedang tutup dan belum ada data grafik untuk ditampilkan. Sistem akan mengambil data baru otomatis saat market buka kembali.",
      buttonLabel: "Cek Data Terakhir",
      chartStatusText: `Market jeda · Harga terakhir ${lastPrice}`,
      chartNotice: hasStoredCandles
        ? `Market sedang jeda. Grafik menampilkan data terakhir, bukan pergerakan live baru.`
        : "Market sedang jeda dan data grafik terakhir belum tersedia.",
      emptyM1Text: "Market sedang jeda. Data M1 terakhir belum tersedia.",
      emptyM15Text: "Market sedang jeda. Data M15 terakhir belum tersedia."
    };
  }

  return {
    type: "reconnecting",
    navLabel: "Koneksi market tersambung ulang",
    feedLabel: "Reconnecting",
    pill: "SINKRON MARKET TERJEDA",
    title: "Sinkronisasi market menunggu koneksi stabil",
    description: `Data market terakhir masuk ${lastText}. Grafik dan riwayat dijeda sementara agar dashboard tidak menampilkan data lama sebagai data terbaru. Sistem akan mencoba tersambung kembali otomatis setiap 30 detik.`,
    buttonLabel: "Cek Ulang Sekarang",
    chartStatusText: "Koneksi market tersambung ulang",
    chartNotice: hasStoredCandles
      ? "Koneksi live sedang disambungkan ulang. Grafik tetap menampilkan data terakhir yang tersimpan."
      : "Koneksi live sedang disambungkan ulang. Menunggu data grafik terbaru.",
    emptyM1Text: "Menunggu data M1 terbaru...",
    emptyM15Text: "Menunggu data M15 terbaru..."
  };
}

function isForexWeekendPause(now = new Date()) {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const minutes = hour * 60 + minute;
  const fridayClose = 22 * 60;
  const sundayOpen = 22 * 60;

  if (day === 6) return true;
  if (day === 5 && minutes >= fridayClose) return true;
  if (day === 0 && minutes < sundayOpen) return true;
  return false;
}

function getMt5Status(market) {
  const rawTime = market?.receivedAt || market?.serverReceivedAt || market?.updatedAt || market?.timestamp || null;

  if (!rawTime) {
    return {
      isStale: true,
      ageMs: Infinity,
      label: "Koneksi market disiapkan",
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
      label: "Sinkron market dicek",
      lastText: "sedang dicek"
    };
  }

  const ageMs = Date.now() - timeMs;
  const staleMs = 3 * 60 * 1000;
  const isStale = ageMs > staleMs;

  return {
    isStale,
    ageMs,
    label: isStale ? "Koneksi market tersambung ulang" : "Live market online",
    lastText: formatAge(ageMs)
  };
}

function formatSignalAlertStatus(telegram = {}) {
  if (telegram?.ok) return "Sinyal Terkirim";

  const skipped = String(telegram?.skipped || telegram?.reason || "").toLowerCase();

  if (skipped === "not-call-signal") return "Menunggu setup valid";
  if (skipped === "duplicate-alert") return "Notifikasi sudah dikirim";
  if (skipped === "cooldown-active") return "Notifikasi jeda sementara";
  if (skipped === "telegram-bot-token-missing") return "Notifikasi belum aktif";
  if (skipped === "telegram-chat-id-missing") return "Telegram belum terhubung";
  if (skipped.includes("missing")) return "Notifikasi belum lengkap";
  if (skipped.includes("error")) return "Notifikasi perlu dicek";

  return "Sinyal Siaga";
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
  const commandText = !connected && telegramConnect?.telegramCode ? `/connect ${telegramConnect.telegramCode}` : "";
  const displayCommand = connected ? "Telegram sudah terhubung" : (commandText || "/connect XAU-123456");
  const alertPrefs = telegramConnect?.telegramAlerts || {};
  const mainSignalAlert = alertPrefs.mainSignal !== false;
  const resultAlert = alertPrefs.result !== false;
  const anyAlertEnabled = alertPrefs.enabled !== false && (mainSignalAlert || resultAlert);

  async function updateAlertPreference(nextPrefs) {
    if (!connected) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/telegram-alert-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user?.uid,
          mainSignal: nextPrefs.mainSignal,
          result: nextPrefs.result
        })
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Gagal menyimpan pengaturan Telegram.");
        return;
      }

      setMessage("Pengaturan Telegram berhasil disimpan.");
      await onRefresh();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function generateCode() {
    if (connected) {
      setMessage("Telegram sudah terhubung. Klik Putuskan dulu kalau ingin membuat kode baru.");
      return;
    }

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
        setMessage(json.error || "Gagal membuat kode Telegram.");
        return;
      }

      const command = json.instruction || `/connect ${json.code}`;
      setMessage(`Kode baru dibuat. Kode lama otomatis tidak berlaku. Tap Salin Perintah lalu tempel ke bot Telegram: ${command}`);
      await onRefresh();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCommand() {
    if (!commandText) {
      setMessage("Buat kode dulu, baru perintah bisa disalin.");
      return;
    }

    try {
      await navigator.clipboard.writeText(commandText);
      setMessage(`Perintah berhasil disalin: ${commandText}`);
    } catch {
      setMessage(`Salin manual perintah ini: ${commandText}`);
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
        setMessage(json.error || "Gagal memutus Telegram.");
        return;
      }

      setMessage("Telegram berhasil diputus.");
      await onRefresh();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canConnect) return null;

  return (
    <section className={`telegramConnectPanel card ${connected ? "connectedMode" : "setupMode"}`}>
      <div className="telegramConnectHeader">
        <div>
          <span className="pill mini"><Bot size={14} /> TELEGRAM ALERT</span>
          <h3>{connected ? "Notifikasi Telegram Aktif" : "Hubungkan Notifikasi Telegram"}</h3>
          <p>
            {connected
              ? "Akun Telegram sudah terhubung. Sinyal utama dan update hasil otomatis aktif. Kamu bisa matikan manual kapan saja."
              : "Hubungkan akun ke bot Telegram agar notifikasi premium langsung masuk ke chat kamu."}
          </p>
        </div>
        <div className={`telegramStatusBadge ${connected ? "connected" : ""}`}>
          {connected ? "Aktif" : "Belum Terhubung"}
        </div>
      </div>

      {!connected && (
        <>
          <div className="telegramSecurityWarning">
            <b>⚠️ Catatan Keamanan</b>
            <span>Jangan bagikan kode hubung ke siapa pun. Kode ini hanya untuk akun Telegram kamu.</span>
            <span>Kode aktif 15 menit, sekali pakai, dan kode lama otomatis tidak berlaku saat kamu membuat kode baru.</span>
          </div>

          <div className="telegramConnectSteps">
            <b>Cara menghubungkan:</b>
            <span>1. Klik <b>Buat Kode Telegram</b>.</span>
            <span>2. Klik <b>Salin Perintah</b>.</span>
            <span>3. Buka bot Telegram XAU AI.</span>
            <span>4. Tempel perintah, contoh <code>/connect XAU-123456</code>.</span>
            <span>5. Kembali ke dashboard lalu klik <b>Cek Status</b>.</span>
          </div>
        </>
      )}

      {connected ? (
        <div className="telegramConnectedSummary">
          <div className="telegramConnectedIcon">✓</div>
          <div>
            <b>Telegram siap menerima notifikasi premium</b>
            <span>Akun Telegram: {telegramConnect?.telegramChatId || "-"}</span>
            <small>Default setelah terhubung: Sinyal Utama ON dan Update Hasil ON.</small>
          </div>
          <div className="telegramConnectedMeta">
            <small>Notifikasi Premium</small>
            <strong>{anyAlertEnabled ? "ON" : "OFF"}</strong>
          </div>
        </div>
      ) : (
        <div className="telegramConnectGrid">
          <div className="telegramConnectBox">
            <span>Hasil</span>
            <b>Belum terhubung</b>
            <small>Buat kode lalu kirim perintah ke bot Telegram.</small>
          </div>

          <div className="telegramConnectBox">
            <span>Kode Telegram</span>
            <b>{telegramConnect?.telegramCode || "-"}</b>
            <small>{telegramConnect?.telegramCodeExpiresAt ? `Expired: ${formatShortDateTime(telegramConnect.telegramCodeExpiresAt)} · sekali pakai` : "Kode aktif 15 menit dan sekali pakai."}</small>
          </div>

          <div className="telegramConnectBox commandBox">
            <span>Perintah ke Bot</span>
            <b>{displayCommand}</b>
            <small>{commandText ? "Tap Salin Perintah, lalu tempel ke bot Telegram." : "Buat kode dulu untuk membuat perintah asli."}</small>
          </div>
        </div>
      )}

      {connected && (
        <div className="telegramAlertPrepPanel">
          <div>
            <b>Notifikasi Premium Preferences</b>
            <span>Notifikasi otomatis aktif setelah Telegram terhubung. Matikan hanya kalau kamu tidak ingin menerima notifikasi.</span>
          </div>
          <div className="telegramAlertToggleGrid">
            <button
              type="button"
              className={`telegramToggleBtn ${mainSignalAlert ? "on" : "off"}`}
              onClick={() => updateAlertPreference({ mainSignal: !mainSignalAlert, result: resultAlert })}
              disabled={busy}
            >
              Sinyal Utama: {mainSignalAlert ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className={`telegramToggleBtn ${resultAlert ? "on" : "off"}`}
              onClick={() => updateAlertPreference({ mainSignal: mainSignalAlert, result: !resultAlert })}
              disabled={busy}
            >
              Update Hasil: {resultAlert ? "ON" : "OFF"}
            </button>
          </div>
          <small>Kalau Sinyal Utama OFF, kamu tidak akan menerima sinyal otomatis. Kalau Update Hasil OFF, kamu tidak akan menerima kabar Menang / Kalah / Kedaluwarsa. Pengumuman resmi XAU AI tetap bisa dikirim terpisah.</small>
        </div>
      )}

      {message && <div className="adminMessage">{message}</div>}

      <div className="telegramActions compact">
        {!connected && (
          <>
            <button type="button" onClick={generateCode} disabled={busy}>
              {busy ? "Memuat..." : "Generate Kode Telegram"}
            </button>
            <button type="button" className="copyBtn" onClick={copyCommand} disabled={busy || !commandText}>
              <Copy size={16} /> Salin Perintah
            </button>
          </>
        )}
        <button type="button" onClick={onRefresh} disabled={busy}>
          Cek Status
        </button>
        {connected && (
          <button type="button" className="danger" onClick={disconnectTelegram} disabled={busy}>
            Putuskan
          </button>
        )}
      </div>

      <p className="miniNote">
        {connected
          ? "Jika ON, Telegram akan menerima notifikasi premium sesuai pengaturan. Jika OFF, sinyal atau update hasil tidak dikirim ke akun Telegram ini."
          : "Setelah aktif, Sinyal Utama dan Update Hasil otomatis ON. Kamu bisa mematikannya kapan saja."}
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




function AdminStrategyControlCenter({ adminToken }) {
  const defaultControls = {
    mainSignalAlert: true,
    mainSignalResultAlert: true,
    m1ScalpTracking: true,
    m1ScalpResultTracking: true,
    strategyBLiveBacktest: true,
    strategyBAdminAlert: true,
    strategyBResultAdminAlert: true,
    strategyBPremiumUserAlert: false
  };
  const [controls, setControls] = useState(defaultControls);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  useEffect(() => {
    if (adminToken) loadControls();
  }, [adminToken]);

  async function loadControls() {
    if (!adminToken) {
      setMessage("Isi kode admin dulu untuk membuka Strategy Control Center.");
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`/api/strategy-controls?token=${encodeURIComponent(adminToken)}&ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal load strategy controls.");
      setControls({ ...defaultControls, ...(data.controls || {}) });
      setMessage("Strategy control berhasil dimuat.");
    } catch (err) {
      setMessage(err?.message || "Gagal load strategy controls.");
    } finally {
      setBusy(false);
    }
  }

  async function saveControls(nextControls = controls) {
    if (!adminToken) {
      setMessage("Isi kode admin dulu sebelum menyimpan control.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Menyimpan Strategy Control Center...");
      const res = await fetch("/api/strategy-controls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ token: adminToken, controls: nextControls })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal menyimpan strategy controls.");
      setControls({ ...defaultControls, ...(data.controls || nextControls) });
      setLastSavedAt(new Date());
      setMessage(data.message || "Strategy Control Center berhasil disimpan.");
    } catch (err) {
      setMessage(err?.message || "Gagal menyimpan strategy controls.");
    } finally {
      setBusy(false);
    }
  }

  function toggleControl(key) {
    const next = { ...controls, [key]: !controls[key] };
    setControls(next);
    saveControls(next);
  }

  const rows = [
    {
      key: "mainSignalAlert",
      title: "Main Signal Alert",
      mode: controls.mainSignalAlert ? "ON untuk premium user" : "OFF global",
      desc: "Master switch untuk alert Strategi A / Main Signal. User tetap harus Telegram ON agar menerima alert."
    },
    {
      key: "mainSignalResultAlert",
      title: "Main Signal Result Alert",
      mode: controls.mainSignalResultAlert ? "Result alert ON" : "Result alert OFF",
      desc: "Mengatur Menang / Kalah / Kedaluwarsa alert untuk Main Signal dari Auto Result Engine."
    },
  ];

  return (
    <section className="strategyControlCenter">
      <div className="adminTelegramTestHeader">
        <span className="pill mini"><Shield size={14} /> MASTER CONTROL</span>
        <h3>Strategy Control Center</h3>
        <p>Admin master switch untuk Sinyal Utama M1 EMA Cross Direct. Alert user premium hanya jalan kalau master switch admin ON dan toggle user juga ON.</p>
      </div>

      <div className="strategyControlRule card">
        <b>Rumus kirim alert</b>
        <span>Admin Master Switch ON + User Personal Alert ON = alert dikirim. Kalau salah satu OFF, alert tidak dikirim.</span>
      </div>

      <div className="strategyControlGrid">
        {rows.map((row) => (
          <div className={`strategyControlRow ${controls[row.key] ? "on" : "off"}`} key={row.key}>
            <div>
              <small>{row.mode}</small>
              <b>{row.title}</b>
              <span>{row.desc}</span>
            </div>
            <button type="button" onClick={() => toggleControl(row.key)} disabled={busy || !adminToken}>
              {controls[row.key] ? "ON" : "OFF"}
            </button>
          </div>
        ))}
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="adminTelegramTestActions strategyControlActions">
        <button type="button" onClick={loadControls} disabled={busy || !adminToken}>
          <RefreshCcw size={15} /> Refresh Control
        </button>
        <button type="button" onClick={() => saveControls()} disabled={busy || !adminToken}>
          <Shield size={15} /> {busy ? "Menyimpan..." : "Save All"}
        </button>
      </div>

      <p className="miniNote">Terakhir simpan: {lastSavedAt ? lastSavedAt.toLocaleString("id-ID") : "Belum ada perubahan di sesi ini"}. Fokus saat ini: Sinyal Utama M1.</p>
    </section>
  );
}

function AdminTelegramTestPanel({ adminToken }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);

  async function sendTelegramTest() {
    if (!adminToken) {
      setMessage("Isi kode admin dulu sebelum kirim test alert.");
      return;
    }

    try {
      setSending(true);
      setMessage("Mengirim premium test alert...");

      const res = await fetch("/api/telegram-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ source: "admin-dashboard" })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const retryText = data.retryAfterSec ? ` Coba lagi sekitar ${data.retryAfterSec} detik.` : "";
        throw new Error(`${data.error || "Gagal mengirim test alert."}${retryText}`);
      }

      setLastSentAt(new Date());
      setMessage(data.message || "Test alert premium berhasil dikirim ke Telegram.");
    } catch (err) {
      setMessage(err?.message || "Gagal mengirim test alert.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="adminTelegramTestPanel">
      <div className="adminTelegramTestHeader">
        <span className="pill mini"><Radio size={14} /> SECURE TEST</span>
        <h3>Telegram Notifikasi Premium Test</h3>
        <p>Endpoint test sekarang dilindungi kode admin, hanya menerima request POST, dan memiliki cooldown anti-spam.</p>
      </div>

      <div className="adminTelegramTestGrid">
        <div>
          <small>Status keamanan</small>
          <b>Admin Protected</b>
          <span>URL test tidak lagi bisa dipakai bebas dari browser.</span>
        </div>
        <div>
          <small>Cooldown</small>
          <b>Anti-spam aktif</b>
          <span>Default 30 detik, bisa diatur dari ENV.</span>
        </div>
        <div>
          <small>Terakhir test</small>
          <b>{lastSentAt ? lastSentAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Belum ada"}</b>
          <span>Test dikirim ke chat ID global admin.</span>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="adminTelegramTestActions">
        <button type="button" onClick={sendTelegramTest} disabled={sending || !adminToken}>
          <Radio size={15} /> {sending ? "Mengirim..." : "Kirim Test Alert"}
        </button>
      </div>
    </section>
  );
}


function AdminResultAlertTestPanel({ adminToken }) {
  const [message, setMessage] = useState("");
  const [sendingType, setSendingType] = useState("");
  const [lastResult, setLastResult] = useState(null);

  async function sendResultTest(result) {
    if (!adminToken) {
      setMessage("Isi kode admin dulu sebelum kirim test result alert.");
      return;
    }

    try {
      setSendingType(result);
      setMessage(`Mengirim test result alert ${result}...`);

      const res = await fetch("/api/result-alert-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ result, source: "admin-dashboard" })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const retryText = data.retryAfterSec ? ` Coba lagi sekitar ${data.retryAfterSec} detik.` : "";
        throw new Error(`${data.error || "Gagal mengirim test result alert."}${retryText}`);
      }

      setLastResult({ result: data.result || result, sentAt: data.sentAt || new Date().toISOString() });
      setMessage(data.message || `Test result alert ${result} berhasil dikirim ke Telegram.`);
    } catch (err) {
      setMessage(err?.message || "Gagal mengirim test result alert.");
    } finally {
      setSendingType("");
    }
  }

  return (
    <section className="adminTelegramTestPanel resultAlertTestPanel">
      <div className="adminTelegramTestHeader">
        <span className="pill mini"><Target size={14} /> RESULT TEST</span>
        <h3>Telegram Result Alert Test</h3>
        <p>Test format Menang, Kalah, dan Kedaluwarsa ke Telegram tanpa mengubah history asli. Cocok untuk cek tampilan alert sebelum auto result berjalan live.</p>
      </div>

      <div className="adminTelegramTestGrid resultAlertTestGrid">
        <div>
          <small>Mode test</small>
          <b>History Aman</b>
          <span>Pesan hanya dikirim ke Telegram, tidak update data signal.</span>
        </div>
        <div>
          <small>Endpoint</small>
          <b>Admin Protected</b>
          <span>Hanya menerima POST dengan kode admin atau secret test.</span>
        </div>
        <div>
          <small>Terakhir test</small>
          <b>{lastResult ? lastResult.result : "Belum ada"}</b>
          <span>{lastResult?.sentAt ? formatShortDateTime(lastResult.sentAt) : "Pilih tombol Menang / Kalah / Kedaluwarsa."}</span>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="resultAlertTestActions">
        <button type="button" className="win" onClick={() => sendResultTest("WIN")} disabled={Boolean(sendingType) || !adminToken}>
          ✅ {sendingType === "WIN" ? "Mengirim..." : "Test Menang"}
        </button>
        <button type="button" className="loss" onClick={() => sendResultTest("LOSS")} disabled={Boolean(sendingType) || !adminToken}>
          ❌ {sendingType === "LOSS" ? "Mengirim..." : "Test Kalah"}
        </button>
        <button type="button" className="expired" onClick={() => sendResultTest("EXPIRED")} disabled={Boolean(sendingType) || !adminToken}>
          ⚪ {sendingType === "EXPIRED" ? "Mengirim..." : "Test Kedaluwarsa"}
        </button>
      </div>

      <p className="miniNote">Gunakan tombol ini hanya untuk cek format result alert. Untuk result asli tetap lewat Auto Result Engine.</p>
    </section>
  );
}

function AdminStrategyBAlertTestPanel({ adminToken }) {
  const [message, setMessage] = useState("");
  const [sendingType, setSendingType] = useState("");
  const [lastResult, setLastResult] = useState(null);

  async function sendSmcAlertTest(direction) {
    if (!adminToken) {
      setMessage("Isi kode admin dulu sebelum kirim SMC AI test alert.");
      return;
    }

    try {
      setSendingType(direction);
      setMessage(`Mengirim SMC AI ${direction} test alert...`);

      const res = await fetch("/api/strategy-b-alert-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ direction, source: "admin-dashboard" })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const retryText = data.retryAfterSec ? ` Coba lagi sekitar ${data.retryAfterSec} detik.` : "";
        throw new Error(`${data.error || "Gagal mengirim SMC AI test alert."}${retryText}`);
      }

      setLastResult({ direction: data.direction || direction, sentAt: data.sentAt || new Date().toISOString() });
      setMessage(data.message || `SMC AI ${direction} test alert berhasil dikirim ke Telegram admin.`);
    } catch (err) {
      setMessage(err?.message || "Gagal mengirim SMC AI test alert.");
    } finally {
      setSendingType("");
    }
  }

  return (
    <section className="adminTelegramTestPanel smcAlertTestPanel">
      <div className="adminTelegramTestHeader">
        <span className="pill mini"><Target size={14} /> SMC AI TEST</span>
        <h3>SMC AI Notifikasi Telegram Test</h3>
        <p>Test format alert Strategi B ke Telegram admin. Auto admin alert SMC AI juga aktif saat CALL asli, tapi tetap tidak dikirim ke user premium.</p>
      </div>

      <div className="adminTelegramTestGrid resultAlertTestGrid">
        <div>
          <small>Mode</small>
          <b>Admin Test Only</b>
          <span>SMC AI masih live-backtest, belum signal utama.</span>
        </div>
        <div>
          <small>Receiver</small>
          <b>Global Admin Chat</b>
          <span>Menggunakan TELEGRAM_CHAT_ID, bukan multi-user premium.</span>
        </div>
        <div>
          <small>Terakhir test</small>
          <b>{lastResult ? `SMC ${lastResult.direction}` : "Belum ada"}</b>
          <span>{lastResult?.sentAt ? formatShortDateTime(lastResult.sentAt) : "Pilih tombol BUY / SELL."}</span>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="resultAlertTestActions smcAlertTestActions">
        <button type="button" className="win" onClick={() => sendSmcAlertTest("BUY")} disabled={Boolean(sendingType) || !adminToken}>
          🟢 {sendingType === "BUY" ? "Mengirim..." : "Test SMC BUY"}
        </button>
        <button type="button" className="loss" onClick={() => sendSmcAlertTest("SELL")} disabled={Boolean(sendingType) || !adminToken}>
          🔴 {sendingType === "SELL" ? "Mengirim..." : "Test SMC SELL"}
        </button>
      </div>

      <p className="miniNote">Test ini hanya untuk cek format Telegram Strategi B. SMC AI auto admin alert hanya untuk monitoring teknis. Live alert ke user premium belum diaktifkan.</p>
    </section>
  );
}



function AdminStrategyBResultAlertTestPanel({ adminToken }) {
  const [message, setMessage] = useState("");
  const [sendingType, setSendingType] = useState("");
  const [lastResult, setLastResult] = useState(null);

  async function sendSmcResultTest(result) {
    if (!adminToken) {
      setMessage("Isi kode admin dulu sebelum kirim SMC AI result test alert.");
      return;
    }

    try {
      setSendingType(result);
      setMessage(`Mengirim SMC AI result ${result} test alert...`);

      const res = await fetch("/api/strategy-b-result-alert-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ result, source: "admin-dashboard" })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const retryText = data.retryAfterSec ? ` Coba lagi sekitar ${data.retryAfterSec} detik.` : "";
        throw new Error(`${data.error || "Gagal mengirim SMC AI result test alert."}${retryText}`);
      }

      setLastResult({ result: data.result || result, sentAt: data.sentAt || new Date().toISOString() });
      setMessage(data.message || `SMC AI result ${result} test alert berhasil dikirim ke Telegram admin.`);
    } catch (err) {
      setMessage(err?.message || "Gagal mengirim SMC AI result test alert.");
    } finally {
      setSendingType("");
    }
  }

  return (
    <section className="adminTelegramTestPanel smcAlertTestPanel smcResultTestPanel">
      <div className="adminTelegramTestHeader">
        <span className="pill mini"><Target size={14} /> SMC RESULT TEST</span>
        <h3>SMC AI Result Alert Test</h3>
        <p>Test format result Menang, Kalah, dan Kedaluwarsa untuk Strategi B. Auto result asli SMC AI juga dikirim ke Telegram admin/global, sementara user premium belum menerima alert ini.</p>
      </div>

      <div className="adminTelegramTestGrid resultAlertTestGrid">
        <div>
          <small>Mode</small>
          <b>Admin Test Only</b>
          <span>SMC AI tetap live-backtest, bukan sinyal utama.</span>
        </div>
        <div>
          <small>History</small>
          <b>Tidak Diubah</b>
          <span>Tombol ini hanya test format Telegram, bukan update result asli.</span>
        </div>
        <div>
          <small>Terakhir test</small>
          <b>{lastResult ? `SMC ${lastResult.result}` : "Belum ada"}</b>
          <span>{lastResult?.sentAt ? formatShortDateTime(lastResult.sentAt) : "Pilih tombol Menang / Kalah / Kedaluwarsa."}</span>
        </div>
      </div>

      {message && <div className="adminMessage">{message}</div>}

      <div className="resultAlertTestActions smcAlertTestActions">
        <button type="button" className="win" onClick={() => sendSmcResultTest("WIN")} disabled={Boolean(sendingType) || !adminToken}>
          ✅ {sendingType === "WIN" ? "Mengirim..." : "Test SMC Menang"}
        </button>
        <button type="button" className="loss" onClick={() => sendSmcResultTest("LOSS")} disabled={Boolean(sendingType) || !adminToken}>
          ❌ {sendingType === "LOSS" ? "Mengirim..." : "Test SMC Kalah"}
        </button>
        <button type="button" className="expired" onClick={() => sendSmcResultTest("EXPIRED")} disabled={Boolean(sendingType) || !adminToken}>
          ⚪ {sendingType === "EXPIRED" ? "Mengirim..." : "Test SMC Kedaluwarsa"}
        </button>
      </div>

      <p className="miniNote">Step 10AI: auto result asli SMC AI akan mengirim alert ke Telegram admin/global saat Menang / Kalah / Kedaluwarsa. User premium belum menerima alert SMC AI.</p>
    </section>
  );
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
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [expandedUid, setExpandedUid] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 6;
  const stats = useMemo(() => buildAdminStats(users), [users]);
  const broadcastInfo = useMemo(() => buildBroadcastTargetInfo(users, broadcastTarget), [users, broadcastTarget]);
  const broadcastPreviewText = broadcastText.trim() || "Tulis pesan broadcast untuk melihat preview.";

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

  async function runMultiUserDryRun() {
    if (!adminToken) {
      setMessage("Isi ADMIN_ACTION_TOKEN dulu.");
      return;
    }

    setDryRunBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/telegram-multi-user-dry-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          token: adminToken,
          signalType: "MAIN_SIGNAL",
          signalLabel: "Simulasi auto signal premium",
          alertKind: "main"
        })
      });

      const json = await res.json();

      if (!json.ok) {
        setMessage(json.error || "Dry run gagal.");
        return;
      }

      setDryRunResult(json);
      setMessage(`Dry run selesai. Eligible ${json.eligibleCount || 0}, skipped ${json.skippedCount || 0}. Tidak ada Telegram yang dikirim.`);
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setDryRunBusy(false);
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

      setMessage(`Broadcast selesai. Terkirim ${json.successCount}/${json.totalRecipients}, gagal ${json.failedCount}.`);
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
        <AdminStat label="Alert ON" value={stats.telegramAlertEnabled} />
        <AdminStat label="Free" value={stats.free} />
      </div>

      <div className="adminControls advanced compact">
        <label>
          Admin Token
          <input
            value={adminToken}
            onChange={(event) => saveToken(event.target.value)}
            type="password"
            placeholder="Masukkan kode admin"
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

        <div className="adminBroadcastBox compact premiumBroadcastBox">
          <div className="broadcastHeader">
            <div>
              <span className="pill mini"><Bot size={14} /> MANUAL BROADCAST</span>
              <h4>Broadcast Telegram</h4>
              <p>Kirim pengumuman manual ke user Telegram yang sudah connect. Ini berbeda dari Auto Signal Alert.</p>
            </div>
            <div className="broadcastReceiverCard">
              <span>Estimated Receiver</span>
              <b>{broadcastInfo.count}</b>
              <small>{broadcastInfo.label}</small>
            </div>
          </div>

          <div className="broadcastGrid">
            <label>
              Target Broadcast
              <select value={broadcastTarget} onChange={(event) => setBroadcastTarget(event.target.value)}>
                <option value="premium_connected">Premium/Admin Connected</option>
                <option value="all_connected">All Connected</option>
                <option value="admin_connected">Admin Connected</option>
              </select>
            </label>
            <div className="broadcastSafetyNote">
              <b>Manual Broadcast</b>
              <span>Gunakan untuk update penting saja. Auto Signal dan Result Alert tetap mengikuti preferensi user.</span>
            </div>
          </div>

          <label className="broadcastTextareaLabel">
            Isi Pesan
            <textarea
              value={broadcastText}
              onChange={(event) => setBroadcastText(event.target.value)}
              maxLength={900}
              placeholder="Contoh: XAU AI update malam ini. Market sedang jeda, dashboard tetap menampilkan candle terakhir."
            />
          </label>

          <div className="broadcastPreviewBox">
            <span>Preview Telegram</span>
            <p>{broadcastPreviewText}</p>
            <small>{broadcastText.trim().length}/900 karakter</small>
          </div>

          <div className="broadcastFooter">
            <div>
              <b>{broadcastInfo.count} penerima terdeteksi</b>
              <span>Target: {broadcastInfo.label} · Cooldown server aktif untuk anti-spam.</span>
            </div>
            <button type="button" onClick={broadcastTelegram} disabled={busy || !broadcastText.trim()}>
              {busy ? "Mengirim..." : "Send Broadcast"}
            </button>
          </div>
        </div>

        <div className="multiUserDryRunBox">
          <div className="dryRunHeader">
            <div>
              <span className="pill mini"><Radio size={14} /> AUTO ALERT DRY RUN</span>
              <h4>Auto Signal Multi-user Dry Run</h4>
              <p>Simulasi penerima auto signal premium tanpa mengirim pesan Telegram. Aman untuk cek sebelum fitur multi-user alert live.</p>
            </div>
            <button type="button" onClick={runMultiUserDryRun} disabled={dryRunBusy || !adminToken}>
              {dryRunBusy ? "Scanning..." : "Run Dry Run"}
            </button>
          </div>

          <div className="dryRunSummaryGrid">
            <div>
              <small>Mode</small>
              <b>Simulasi</b>
              <span>Tidak kirim Telegram</span>
            </div>
            <div>
              <small>Target</small>
              <b>Premium/Admin</b>
              <span>Telegram connected + alert ON</span>
            </div>
            <div>
              <small>Eligible</small>
              <b>{dryRunResult?.eligibleCount ?? "-"}</b>
              <span>Siap menerima auto signal</span>
            </div>
            <div>
              <small>Skipped</small>
              <b>{dryRunResult?.skippedCount ?? "-"}</b>
              <span>Free/offline/alert OFF</span>
            </div>
          </div>

          {dryRunResult && (
            <div className="dryRunResultGrid">
              <div className="dryRunList ready">
                <b>Receiver Ready</b>
                {(dryRunResult.eligible || []).slice(0, 6).map((item, index) => (
                  <span key={`${item.uid || item.email || index}-ready`}>
                    {item.email || item.uid || "User"} · {item.role} · {item.reason}
                  </span>
                ))}
                {!dryRunResult.eligible?.length && <span>Belum ada receiver eligible.</span>}
              </div>
              <div className="dryRunList skipped">
                <b>Skipped</b>
                {(dryRunResult.skipped || []).slice(0, 6).map((item, index) => (
                  <span key={`${item.uid || item.email || index}-skip`}>
                    {item.email || item.uid || "User"} · {item.role} · {item.reason}
                  </span>
                ))}
                {!dryRunResult.skipped?.length && <span>Tidak ada user yang diskip.</span>}
              </div>
            </div>
          )}
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
                    <span><b>Alert:</b> {formatTelegramAlertPrefs(user)}</span>
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

function buildBroadcastTargetInfo(users, target) {
  const connected = (users || []).filter((user) => user?.telegramConnected && user?.telegramChatId);
  const premium = connected.filter((user) => isBroadcastPremium(user));
  const admin = connected.filter((user) => user?.role === "admin");

  if (target === "all_connected") {
    return {
      count: uniqueTelegramCount(connected),
      label: "Semua Telegram connected"
    };
  }

  if (target === "admin_connected") {
    return {
      count: uniqueTelegramCount(admin),
      label: "Admin connected"
    };
  }

  return {
    count: uniqueTelegramCount(premium),
    label: "Premium/Admin connected"
  };
}

function uniqueTelegramCount(users) {
  const seen = new Set();
  (users || []).forEach((user) => {
    const chatId = String(user?.telegramChatId || "");
    if (chatId) seen.add(chatId);
  });
  return seen.size;
}

function isBroadcastPremium(user) {
  if (!user) return false;
  if (user.status && user.status !== "active") return false;
  if (user.role === "admin") return true;
  if (user.role !== "premium") return false;
  const until = user.premiumUntil || user.expiredAt || null;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
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
    telegramConnected: 0,
    telegramAlertEnabled: 0
  };

  users.forEach((user) => {
    if (user.telegramConnected && user.telegramChatId) stats.telegramConnected += 1;
    if (user.telegramConnected && user.telegramChatId && user.telegramAlertEnabled !== false) stats.telegramAlertEnabled += 1;
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
  if (user.role === "premium" && !isAdminPremiumActive(user)) return "Kedaluwarsa";
  return (user.role || "free").toUpperCase();
}

function formatTelegramAlertPrefs(user) {
  if (!user?.telegramConnected || !user?.telegramChatId) return "Belum terhubung";
  const main = user.telegramAlertMainSignal !== false ? "Main ON" : "Main OFF";
  const result = user.telegramAlertResult !== false ? "Result ON" : "Result OFF";
  return `${main} · ${result}`;
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
          {loadingHistory ? "Memuat..." : "Refresh"}
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


function ResultTrackerPrepPanel({ callHistory, scalpHistory, market, signal, isAdmin, adminToken, trackerState, onRunTracker, cronHealth, onRefreshCronHealth }) {
  const callItems = callHistory?.history || [];
  // Fokus versi sekarang hanya sinyal utama. Data Scalp lama tidak ikut dihitung supaya angka Auto Result sinkron dengan history utama.
  const allItems = callItems.map((item) => ({ ...item, trackerType: "SINYAL UTAMA" }));
  const allRunningItems = allItems.filter((item) => isOpenResult(item));
  const runningItems = allRunningItems;
  const closedItems = allItems.filter((item) => !isOpenResult(item));
  const shouldScrollQueue = allRunningItems.length > 6;
  const lastPrice = getTrackerMarketPrice(market, signal);
  const trackerReady = allRunningItems.length > 0 && lastPrice;
  const updatedCount = trackerState?.updatedCount || 0;
  const scannedCount = trackerState?.scanned || 0;
  const resultAlertSentCount = trackerState?.resultAlertSentCount || 0;
  const resultAlertSkippedCount = trackerState?.resultAlertSkippedCount || 0;
  const tp1AlertSentCount = trackerState?.tp1AlertSentCount || 0;

  return (
    <section className="resultTrackerPanel card">
      <div className="sectionTitle">
        <div>
          <span className="pill mini"><Target size={14} /> AUTO RESULT</span>
          <h3>Pantauan Hasil Sinyal</h3>
          <span>Sistem otomatis memantau sinyal aktif berdasarkan harga live, target, batas risiko, dan batas waktu.</span>
        </div>
        <div className={`trackerStatusBadge ${trackerReady ? "ready" : "standby"}`}>
          {trackerReady ? "Siap Memantau" : "Menunggu"}
        </div>
      </div>

      <div className="trackerSummaryGrid">
        <div>
          <small>Sinyal Aktif</small>
          <strong>{allRunningItems.length}</strong>
          <span>Sinyal utama yang masih berjalan dan belum selesai.</span>
        </div>
        <div>
          <small>Sinyal Selesai</small>
          <strong>{closedItems.length}</strong>
          <span>Sinyal yang sudah punya hasil akhir.</span>
        </div>
        <div>
          <small>Harga Live</small>
          <strong>{lastPrice ? formatPrice(lastPrice) : "-"}</strong>
          <span>Harga acuan untuk pembaruan hasil berikutnya.</span>
        </div>
      </div>

      <CronHealthMonitor cronHealth={cronHealth} onRefresh={onRefreshCronHealth} />

      <div className="trackerLiteNotice autoEngineNotice">
        <b>Auto Result aktif</b>
        <span>Sistem memantau sinyal aktif. Dashboard membaca data live tiap 3 detik saat feed sehat. Saat TP1 tersentuh, batas risiko otomatis pindah ke BE. Hasil akhir tetap menunggu Target Max, SL, BE, atau batas waktu.</span>
      </div>

      {isAdmin && (
        <div className="trackerControlBox">
          <div>
            <b>Cek Manual Hasil</b>
            <span>{trackerState?.message || "Klik tombol untuk memperbarui hasil sinyal aktif sekarang."}</span>
            {trackerState?.lastRun ? <small>Terakhir diperbarui: {formatHistoryTime(trackerState.lastRun)} · Dicek {scannedCount} · Diperbarui {updatedCount} · Result TG {resultAlertSentCount} · TP1 TG {tp1AlertSentCount}</small> : null}
            {resultAlertSkippedCount > 0 ? <small>{resultAlertSkippedCount} hasil belum terkirim ke Telegram karena koneksi notifikasi belum aktif.</small> : null}
          </div>
          <button type="button" onClick={onRunTracker} disabled={trackerState?.loading || !adminToken}>
            <RefreshCcw size={15} /> {trackerState?.loading ? "Mengecek..." : "Update Hasil"}
          </button>
        </div>
      )}

      {trackerState?.updated?.length > 0 && (
        <div className="trackerUpdateList">
          {trackerState.updated.slice(0, 5).map((item) => (
            <span key={`${item.type}-${item.id}`}>
              {item.type} · {item.tp1BreakEvenUpdate ? "TP1 kena · BE aktif" : item.result} · {formatPrice(item.price)} · Telegram {item.tp1AlertSent || item.resultAlertSent ? "Sent" : "Menunggu"}
            </span>
          ))}
        </div>
      )}

      <div className={`trackerQueue ${shouldScrollQueue ? "scrollMode" : ""}`}>
        <div className="trackerQueueHead">
          <span>Sinyal</span>
          <span>Harga Masuk</span>
          <span>Risiko / Target</span>
          <span>Hasil</span>
        </div>
        {runningItems.map((item) => (
          <div className="trackerQueueRow" key={`${item.trackerType}-${item.id || item.createdAt || item.candleTime}`}>
            <strong className={String(item.signal || "").toLowerCase()}>{item.trackerType} · {item.signal || "-"}</strong>
            <span>{item.entry || "-"}</span>
            <span>{formatRiskTargetText(item)}</span>
            <em className={`resultBadge ${getResultStatusTone(item)}`}>{formatResultStatus(item)}</em>
          </div>
        ))}
        {shouldScrollQueue && (
          <div className="trackerQueueInfo">Semua sinyal aktif ditampilkan. Scroll daftar ini untuk melihat sinyal lama tanpa membuat halaman terlalu panjang.</div>
        )}
        {allRunningItems.length === 0 && (
          <div className="trackerEmpty">Belum ada sinyal aktif. Sinyal yang sedang berjalan akan tampil di sini.</div>
        )}
      </div>
    </section>
  );
}


function CronHealthMonitor({ cronHealth, onRefresh }) {
  const data = cronHealth?.data || null;
  const tone = data?.tone || "standby";
  const statusLabel = data?.label || (cronHealth?.loading ? "Loading" : "Belum ada data");
  const lastRunText = data?.lastRunAt ? formatHistoryTime(data.lastRunAt) : "-";
  const lastRunAge = data?.lastRunAgeSec != null ? formatSecondsToAge(data.lastRunAgeSec) : "-";
  const feedAge = data?.liveFeedAgeSec != null ? formatSecondsToAge(data.liveFeedAgeSec) : "-";
  const bybitLabel = data?.bybitUsed ? "Dipakai" : "Tidak dipakai";

  return (
    <div className={`cronHealthPanel ${tone}`}>
      <div className="cronHealthTop">
        <div>
          <span className="pill mini">AUTO RESULT</span>
          <h4>Status Auto Result</h4>
          <p>Memantau pembaruan hasil otomatis. Status panel ini diperbarui tiap 30 detik, sedangkan eksekusi hasil tetap mengikuti jadwal cron.</p>
        </div>
        <div className={`cronHealthBadge ${tone}`}>{statusLabel}</div>
      </div>

      {cronHealth?.error && (
        <div className="cronHealthError">{cronHealth.error}</div>
      )}

      <div className="cronHealthGrid">
        <div>
          <small>Update Terakhir</small>
          <strong>{lastRunText}</strong>
          <span>{lastRunAge}</span>
        </div>
        <div>
          <small>Umur Data Market</small>
          <strong>{feedAge}</strong>
          <span>{data?.liveFeedTime ? `Waktu data: ${formatHistoryTime(data.liveFeedTime)}` : "Menunggu data terbaru"}</span>
        </div>
        <div>
          <small>Aktivitas Terakhir</small>
          <strong>{data ? `Dicek ${data.scanned || 0} · Diperbarui ${data.updatedCount || 0}` : "-"}</strong>
          <span>Telegram terkirim {data?.resultAlertSentCount || 0} · dilewati {data?.resultAlertSkippedCount || 0}</span>
        </div>
        <div>
          <small>Sumber Data</small>
          <strong>Live Gold Feed</strong>
          <span>Cadangan market: {bybitLabel}</span>
        </div>
      </div>

      <div className="cronHealthFooter">
        <span>{data?.action || "Status akan tampil setelah sistem pembaruan hasil berjalan."}</span>
        <button type="button" onClick={onRefresh} disabled={cronHealth?.loading}>
          <RefreshCcw size={14} /> {cronHealth?.loading ? "Memuat..." : "Refresh Status"}
        </button>
      </div>
    </div>
  );
}

function formatSecondsToAge(value) {
  const sec = Number(value);
  if (!Number.isFinite(sec) || sec < 0) return "-";
  if (sec < 60) return `${Math.round(sec)} detik`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit`;
  const hour = Math.floor(min / 60);
  const restMin = min % 60;
  if (hour < 24) return restMin ? `${hour} jam ${restMin} menit` : `${hour} jam`;
  const day = Math.floor(hour / 24);
  const restHour = hour % 24;
  return restHour ? `${day} hari ${restHour} jam` : `${day} hari`;
}

function PerformanceAnalyticsPanel({ callHistory, scalpHistory, isAdmin, adminToken, onResetAnalytics }) {
  const callItems = callHistory?.history || [];
  const analyticsReset = callHistory?.analyticsReset || {};

  const call7 = buildPerformanceStats(callItems, 7, analyticsReset);
  const call30 = buildPerformanceStats(callItems, 30, analyticsReset);

  const best = pickBestPerformance([
    { label: "SINYAL UTAMA 7D", ...call7 },
    { label: "SINYAL UTAMA 30D", ...call30 }
  ]);

  return (
    <section className="performancePanel card">
      <div className="sectionTitle">
        <div>
          <span className="pill mini">PERFORMA</span>
          <h3>Performa 7/30 Hari</h3>
          <span>Ringkasan hasil terbaru. Sinyal yang masih berjalan belum dihitung ke winrate.</span>
        </div>
        <div className="performanceHighlight">
          <small>Performa Terbaik</small>
          <b>{best ? `${best.label} · ${best.cleanWinRate}% WR Bersih` : "Menunggu data"}</b>
          {best ? <span>{best.wins} Menang dari {best.closed} sinyal selesai · {best.expired} kedaluwarsa</span> : <span>Menunggu sinyal selesai.</span>}
        </div>
      </div>

      <div className="performanceGrid">
        <PerformanceCard title="SINYAL UTAMA" period="7 Hari" stats={call7} />
        <PerformanceCard title="SINYAL UTAMA" period="30 Hari" stats={call30} />
      </div>

      <div className="performanceSummary">
        <div>
          <b>Ringkasan Terbaru</b>
          <span>{buildPerformanceSummary(call7, call30, null, null)}</span>
        </div>
        <div>
          <b>Catatan</b>
          <span>Winrate bersih dihitung dari sinyal selesai. Sinyal kedaluwarsa dipisah, dan sinyal berjalan belum dihitung.</span>
        </div>
      </div>

      {isAdmin && (
        <AnalyticsResetPanel
          analyticsReset={analyticsReset}
          adminToken={adminToken}
          onResetAnalytics={onResetAnalytics}
        />
      )}

      <Tp1BeAnalytics items={callItems} analyticsReset={analyticsReset} />
      <LimitPullbackAnalytics items={callItems} analyticsReset={analyticsReset} />

      {isAdmin && (
        <div className="performanceAdminNote">
          Analisis otomatis mengikuti hasil terbaru. Pastikan pembaruan hasil tetap aktif agar performa selalu akurat.
        </div>
      )}
    </section>
  );
}



function AnalyticsResetPanel({ analyticsReset, adminToken, onResetAnalytics }) {
  const allStart = analyticsReset?.allStartAt || null;
  const limitStart = analyticsReset?.limitStartAt || null;

  return (
    <div className="analyticsResetBox">
      <div>
        <b>Reset Analisis</b>
        <span>Reset hanya mengubah titik mulai hitungan analisis. History trade tetap aman dan tidak dihapus.</span>
        <small>
          Semua analisis: {allStart ? formatHistoryTime(allStart) : "Belum direset"} · Limit: {limitStart ? formatHistoryTime(limitStart) : "Belum direset"}
        </small>
      </div>
      <div className="analyticsResetActions">
        <button type="button" onClick={() => onResetAnalytics?.("limit")} disabled={!adminToken}>Reset Limit</button>
        <button type="button" onClick={() => onResetAnalytics?.("all")} disabled={!adminToken}>Reset Semua Analisis</button>
      </div>
    </div>
  );
}

function LimitPullbackAnalytics({ items, analyticsReset }) {
  const stats7 = buildLimitPullbackStats(items, 7, analyticsReset);
  const stats30 = buildLimitPullbackStats(items, 30, analyticsReset);

  return (
    <div className="tp1AnalyticsBox limitAnalyticsBox">
      <div className="tp1AnalyticsHead">
        <div>
          <b>Analisis Limit Pullback</b>
          <span>Mengukur opsi entry manual di area EMA pullback. Target limit memakai RR 1:1, TP1 setengah target, lalu SL pindah ke BE.</span>
        </div>
        <em>{stats7.winRate}% WR Limit 7D</em>
      </div>

      <div className="tp1AnalyticsGrid">
        <LimitPullbackCard title="7 Hari" stats={stats7} />
        <LimitPullbackCard title="30 Hari" stats={stats30} />
      </div>
    </div>
  );
}

function LimitPullbackCard({ title, stats }) {
  return (
    <div className="tp1AnalyticsCard">
      <div className="tp1AnalyticsTop">
        <span>{title}</span>
        <strong>{stats.winRate}%</strong>
      </div>
      <small>WR Limit RR 1:1</small>

      <div className="tp1MiniGrid">
        <div><span>Total</span><b>{stats.total}</b></div>
        <div><span>Limit kena</span><b>{stats.triggered}</b></div>
        <div><span>TP Max</span><b>{stats.wins}</b></div>
        <div><span>BE</span><b>{stats.be}</b></div>
        <div><span>SL</span><b>{stats.losses}</b></div>
        <div><span>Berjalan</span><b>{stats.open}</b></div>
      </div>

      <p>{buildLimitPullbackNote(stats)}</p>
    </div>
  );
}

function Tp1BeAnalytics({ items, analyticsReset }) {
  const stats7 = buildTp1BeStats(items, 7, analyticsReset);
  const stats30 = buildTp1BeStats(items, 30, analyticsReset);

  return (
    <div className="tp1AnalyticsBox">
      <div className="tp1AnalyticsHead">
        <div>
          <b>Analisis TP1 & BE</b>
          <span>Membaca apakah sinyal sering minimal menyentuh TP1 sebelum lanjut TP Max, balik BE, atau kena SL duluan.</span>
        </div>
        <em>{stats7.tp1HitRate}% TP1 Rate 7D</em>
      </div>

      <div className="tp1AnalyticsGrid">
        <Tp1BeCard title="7 Hari" stats={stats7} />
        <Tp1BeCard title="30 Hari" stats={stats30} />
      </div>
    </div>
  );
}

function Tp1BeCard({ title, stats }) {
  return (
    <div className="tp1AnalyticsCard">
      <div className="tp1AnalyticsTop">
        <span>{title}</span>
        <strong>{stats.tp1HitRate}%</strong>
      </div>
      <small>TP1 Hit Rate</small>

      <div className="tp1MiniGrid">
        <div><span>Total</span><b>{stats.total}</b></div>
        <div><span>TP1 kena</span><b>{stats.tp1Touched}</b></div>
        <div><span>TP Max</span><b>{stats.afterTp1Win}</b></div>
        <div><span>Balik BE</span><b>{stats.afterTp1Be}</b></div>
        <div><span>SL duluan</span><b>{stats.directLoss}</b></div>
        <div><span>BE aktif</span><b>{stats.openProtected}</b></div>
      </div>

      <p>{buildTp1BeNote(stats)}</p>
    </div>
  );
}

function PerformanceCard({ title, period, stats }) {
  const wrClass = stats.cleanWinRate >= 70 ? "strong" : stats.cleanWinRate >= 50 ? "normal" : "weak";

  return (
    <div className="performanceCard">
      <div className="performanceCardTop">
        <div>
          <span>{title}</span>
          <h4>{period}</h4>
        </div>
        <b className={wrClass}>{stats.cleanWinRate}%</b>
      </div>

      <div className="performanceSubRate">
        <span>WR Bersih</span>
        <em>WR Total {stats.totalWinRate}%</em>
      </div>

      <div className="performanceBars performanceBarsFive">
        <div>
          <small>Selesai</small>
          <strong>{stats.closed}</strong>
        </div>
        <div>
          <small>Menang</small>
          <strong>{stats.wins}</strong>
        </div>
        <div>
          <small>Kalah</small>
          <strong>{stats.losses}</strong>
        </div>
        <div>
          <small>BE</small>
          <strong>{stats.be}</strong>
        </div>
        <div>
          <small>Exp</small>
          <strong>{stats.expired}</strong>
        </div>
      </div>

      <div className="wrBar">
        <i style={{ width: `${Math.min(100, Math.max(0, stats.cleanWinRate))}%` }} />
      </div>

      <p>{stats.total} total sinyal · {stats.open} berjalan · {stats.expired} kedaluwarsa</p>
    </div>
  );
}

function isOpenResult(item) {
  const result = String(item?.result || item?.status || "OPEN").toUpperCase();
  return ["OPEN", "RUNNING", "PENDING", "WAITING"].includes(result);
}

function formatResultStatus(item) {
  const raw = String(item?.result || item?.status || "OPEN").toUpperCase();
  if (raw === "OPEN" || raw === "RUNNING" || raw === "PENDING" || raw === "WAITING") {
    return isTp1BreakEvenActive(item) ? "TP1 kena · BE aktif" : "Berjalan";
  }
  if (raw === "BE" || raw === "BREAKEVEN") return "BE";
  if (raw === "WIN") return "Menang";
  if (raw === "LOSS") return "Kalah";
  if (raw === "EXPIRED") return "Kedaluwarsa";
  return raw || "Berjalan";
}

function getResultStatusTone(item) {
  const raw = String(item?.result || item?.status || "OPEN").toUpperCase();
  if (["OPEN", "RUNNING", "PENDING", "WAITING"].includes(raw)) return isTp1BreakEvenActive(item) ? "be" : "running";
  if (raw === "EXPIRED") return "expired";
  if (raw === "BE" || raw === "BREAKEVEN") return "be";
  if (raw === "WIN") return "win";
  if (raw === "LOSS") return "loss";
  return "open";
}

function isTp1BreakEvenActive(item = {}) {
  return item.tp1Hit === true || item.breakEvenActive === true || item.beActive === true;
}

function formatRiskTargetText(item = {}) {
  const tp = item.tp || item.tpMax || item.tp2 || "-";
  if (isTp1BreakEvenActive(item)) {
    const be = item.bePrice || item.breakEvenPrice || item.entry || "-";
    return `BE ${be} / ${tp}`;
  }
  return `${item.sl || "-"} / ${tp}`;
}

function getTrackerMarketPrice(market, signal) {
  const direct = Number(
    market?.lastPrice ??
    market?.price ??
    market?.latest?.lastPrice ??
    market?.m1?.lastPrice ??
    signal?.entry ??
    0
  );
  if (Number.isFinite(direct) && direct > 0) return direct;

  const m1 = market?.m1 || market?.candles?.m1 || market?.candlesM1 || [];
  const last = Array.isArray(m1) ? m1[m1.length - 1] : null;
  const price = Number(last?.close ?? last?.c ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

function buildPerformanceStats(items, days, analyticsReset = {}) {
  const now = Date.now();
  const periodFrom = now - days * 24 * 60 * 60 * 1000;
  const resetFrom = parseHistoryTimeMs(analyticsReset?.allStartAt);
  const from = resetFrom ? Math.max(periodFrom, resetFrom) : periodFrom;

  const filtered = (items || []).filter((item) => {
    const t = parseHistoryTimeMs(item.createdAt || item.candleTime || item.time || item.timestamp || item.closedAt || item.resultAt);
    if (!t) return true; // data lama tanpa timestamp tetap dihitung supaya tidak kosong
    return t >= from;
  });

  let wins = 0;
  let losses = 0;
  let be = 0;
  let expired = 0;
  let open = 0;

  filtered.forEach((item) => {
    const result = formatResultStatus(item);

    if (result === "Menang") wins += 1;
    else if (result === "Kalah") losses += 1;
    else if (result === "BE") be += 1;
    else if (result === "Kedaluwarsa") expired += 1;
    else open += 1;
  });

  const closed = wins + losses + be;
  const totalSelesai = closed + expired;
  const cleanWinRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;
  const totalWinRate = totalSelesai > 0 ? Math.round((wins / totalSelesai) * 100) : 0;

  return {
    days,
    total: filtered.length,
    closed,
    totalSelesai,
    wins,
    losses,
    be,
    expired,
    open,
    winRate: cleanWinRate,
    cleanWinRate,
    totalWinRate
  };
}



function buildLimitPullbackStats(items, days, analyticsReset = {}) {
  const now = Date.now();
  const periodFrom = now - days * 24 * 60 * 60 * 1000;
  const resetFrom = parseHistoryTimeMs(analyticsReset?.limitStartAt || analyticsReset?.allStartAt);
  const from = resetFrom ? Math.max(periodFrom, resetFrom) : periodFrom;
  const filtered = (items || []).filter((item) => {
    const t = parseHistoryTimeMs(item.createdAt || item.candleTime || item.time || item.timestamp || item.closedAt || item.resultAt);
    if (!t) return true;
    return t >= from;
  });

  let total = 0;
  let triggered = 0;
  let wins = 0;
  let losses = 0;
  let be = 0;
  let open = 0;
  let tp1Hit = 0;

  filtered.forEach((item) => {
    const plan = item.pullbackLimitPlan || item.strategySnapshot?.mainM5?.pullbackLimitPlan || null;
    if (!plan?.limitEntry) return;
    total += 1;
    if (item.pullbackLimitTriggered) triggered += 1;
    if (item.pullbackLimitTp1Hit || item.pullbackLimitBeActive) tp1Hit += 1;
    const result = String(item.pullbackLimitResult || "").toUpperCase();
    if (result === "WIN") wins += 1;
    else if (result === "LOSS") losses += 1;
    else if (result === "BE" || result === "BREAKEVEN") be += 1;
    else if (item.pullbackLimitTriggered) open += 1;
  });

  const closed = wins + losses + be;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;
  const touchRate = total > 0 ? Math.round((triggered / total) * 100) : 0;
  const tp1Rate = triggered > 0 ? Math.round((tp1Hit / triggered) * 100) : 0;

  return { days, total, triggered, wins, losses, be, open, closed, winRate, touchRate, tp1Hit, tp1Rate };
}

function buildLimitPullbackNote(stats) {
  if (!stats.total) return "Menunggu sinyal yang punya plan limit pullback.";
  if (!stats.triggered) return `Ada ${stats.total} plan limit, tapi belum ada limit yang tersentuh dalam ${stats.days} hari.`;
  return `${stats.triggered}/${stats.total} limit tersentuh (${stats.touchRate}%). Dari yang selesai: ${stats.wins} TP Max, ${stats.be} BE, ${stats.losses} SL. TP1 limit rate ${stats.tp1Rate}%.`;
}

function buildTp1BeStats(items, days, analyticsReset = {}) {
  const now = Date.now();
  const periodFrom = now - days * 24 * 60 * 60 * 1000;
  const resetFrom = parseHistoryTimeMs(analyticsReset?.allStartAt);
  const from = resetFrom ? Math.max(periodFrom, resetFrom) : periodFrom;
  const filtered = (items || []).filter((item) => {
    const t = parseHistoryTimeMs(item.createdAt || item.candleTime || item.time || item.timestamp || item.closedAt || item.resultAt);
    if (!t) return true;
    return t >= from;
  });

  let tp1Touched = 0;
  let afterTp1Win = 0;
  let afterTp1Be = 0;
  let directLoss = 0;
  let expired = 0;
  let openProtected = 0;
  let openPlain = 0;

  filtered.forEach((item) => {
    const result = formatResultStatus(item);
    const raw = String(item?.result || item?.status || "OPEN").toUpperCase();
    const protectedByBe = isTp1BreakEvenActive(item);
    const win = result === "Menang" || raw === "WIN";
    const be = result === "BE" || raw === "BE" || raw === "BREAKEVEN";
    const loss = result === "Kalah" || raw === "LOSS";
    const exp = result === "Kedaluwarsa" || raw === "EXPIRED";
    const open = isOpenResult(item);
    const touched = protectedByBe || win || be;

    if (touched) tp1Touched += 1;
    if (win) afterTp1Win += 1;
    if (be) afterTp1Be += 1;
    if (loss && !protectedByBe) directLoss += 1;
    if (exp) expired += 1;
    if (open && protectedByBe) openProtected += 1;
    if (open && !protectedByBe) openPlain += 1;
  });

  const total = filtered.length;
  const tp1HitRate = total > 0 ? Math.round((tp1Touched / total) * 100) : 0;
  const directLossRate = total > 0 ? Math.round((directLoss / total) * 100) : 0;
  const beAfterTp1Rate = tp1Touched > 0 ? Math.round((afterTp1Be / tp1Touched) * 100) : 0;
  const tpMaxAfterTp1Rate = tp1Touched > 0 ? Math.round((afterTp1Win / tp1Touched) * 100) : 0;

  return {
    days,
    total,
    tp1Touched,
    tp1HitRate,
    afterTp1Win,
    afterTp1Be,
    directLoss,
    directLossRate,
    beAfterTp1Rate,
    tpMaxAfterTp1Rate,
    openProtected,
    openPlain,
    expired
  };
}

function buildTp1BeNote(stats) {
  if (!stats.total) return "Menunggu sample sinyal baru.";
  if (stats.tp1Touched === 0) return `Belum ada sinyal ${stats.days} hari yang menyentuh TP1. Pantau apakah SL terlalu dekat atau entry terlalu cepat.`;
  return `Dari ${stats.total} sinyal, ${stats.tp1Touched} sudah menyentuh TP1. ${stats.afterTp1Win} lanjut TP Max, ${stats.afterTp1Be} balik BE, ${stats.directLoss} kena SL sebelum TP1.`;
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
  const valid = statsList.filter((item) => item.closed > 0 || item.expired > 0);
  if (!valid.length) return null;

  return valid.sort((a, b) => {
    if (b.cleanWinRate !== a.cleanWinRate) return b.cleanWinRate - a.cleanWinRate;
    if (b.closed !== a.closed) return b.closed - a.closed;
    return b.totalSelesai - a.totalSelesai;
  })[0];
}

function buildPerformanceSummary(call7, call30, scalp7, scalp30) {
  const parts = [];
  const empty = { closed: 0, expired: 0, cleanWinRate: 0, wins: 0, losses: 0, be: 0 };
  scalp7 = scalp7 || empty;
  scalp30 = scalp30 || empty;

  if (call7.closed > 0 || call7.expired > 0) {
    parts.push(`SINYAL UTAMA 7D WR Bersih ${call7.cleanWinRate}% · ${call7.wins}W/${call7.losses}L/${call7.be}BE · ${call7.expired} Exp`);
  }

  if (scalp7.closed > 0 || scalp7.expired > 0) {
    parts.push(`SCALP M5 7D WR Bersih ${scalp7.cleanWinRate}% · ${scalp7.wins}W/${scalp7.losses}L/${scalp7.be}BE · ${scalp7.expired} Exp`);
  }

  if (!parts.length) {
    if (call30.closed || call30.expired || scalp30.closed || scalp30.expired) {
      return `Data 7 hari masih tipis. 30D: SINYAL UTAMA ${call30.cleanWinRate}% WR Bersih (${call30.expired} Exp), SCALP M5 ${scalp30.cleanWinRate}% WR Bersih (${scalp30.expired} Exp).`;
    }

    return "Analisis akan makin akurat setelah sistem mengumpulkan hasil Menang / Kalah / BE / Kedaluwarsa.";
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
            {loadingOrders ? "Memuat..." : "Refresh Orders"}
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
            <span>Asisten Market Gold</span>
          </div>
        </div>

        <div className="landingNavActions">
          <a href="#features">Fitur</a>
          <a href="#pricing">Paket</a>
          <a href="#faq">FAQ</a>
          <div className="landingFooterActions">
          <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Support</a>
          <button type="button" onClick={onLogin}>Masuk / Daftar</button>
        </div>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingHeroText">
          <span className="pill mini">ASISTEN PREMIUM XAUUSD</span>
          <h1>Dashboard sinyal XAUUSD dengan notifikasi Telegram premium.</h1>
          <p>
            XAU AI Signal membantu memantau market gold dengan fokus utama EMA 9/20 M1, notifikasi Telegram, auto result, dan riwayat performa yang transparan.
          </p>

          <div className="landingCta">
            <button type="button" onClick={onLogin}>Mulai Masuk / Daftar</button>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Support</a>
            <a href="#features">Lihat Fitur</a>
          </div>

          <div className="landingTrust">
            <span>Notifikasi Telegram</span>
            <span>Main Signal M1</span>
            <span>Riwayat Sinyal</span>
          </div>
        </div>

        <div className="landingHeroCard">
          <div className="heroSignalTop">
            <span>PREVIEW SINYAL UTAMA</span>
            <b>Pemantau Market AI</b>
          </div>

          <div className="heroSignalBox">
            <small>Mode Sinyal</small>
            <strong>BUY / SELL Premium</strong>
            <p>Muncul hanya saat rule utama sudah valid.</p>
          </div>

          <div className="heroSignalGrid">
            <div><small>Rule</small><b>EMA 9/20 M1</b></div>
            <div><small>Validasi</small><b>Close Candle</b></div>
            <div><small>Risk Plan</small><b>TP1 · BE · RR 1:1.25</b></div>
            <div><small>Alert</small><b>Telegram</b></div>
          </div>
        </div>
      </section>

      <section className="landingStats">
        <div><b>SINYAL UTAMA</b><span>Fokus EMA Cross M1</span></div>
        <div><b>DIRECT ENTRY</b><span>Masuk setelah candle M1 valid</span></div>
        <div><b>RISK PLAN</b><span>TP1, BE, dan RR 1:1.25</span></div>
        <div><b>RIWAYAT</b><span>Winrate & hasil transparan</span></div>
      </section>

      <section className="landingSection" id="features">
        <div className="landingSectionTitle">
          <span className="pill mini">FITUR PREMIUM</span>
          <h2>Apa yang kamu dapat?</h2>
          <p>Dashboard dibuat untuk membaca kondisi market secara cepat tanpa harus bolak-balik cek banyak indikator.</p>
        </div>

        <div className="landingFeatureGrid">
          <LandingFeature title="Alert Sinyal Utama" text="Notifikasi BUY/SELL saat kondisi utama sudah valid." />
          <LandingFeature title="Main Signal M1" text="Fokus pada satu strategi utama: EMA9 cross EMA20 M1 dengan close filter dan target RR 1:1.25." />
          <LandingFeature title="Risk Plan Jelas" text="TP1, break-even, target max, dan batas risiko tampil jelas di dashboard." />
          <LandingFeature title="Notifikasi Telegram" text="User premium bisa connect Telegram untuk menerima alert langsung." />
          <LandingFeature title="Grafik Live" text="Chart M1, EMA 9/20, garis entry, target, risiko, dan status market." />
          <LandingFeature title="Riwayat Performa" text="Riwayat sinyal valid, hasil, dan winrate untuk evaluasi transparan." />
        </div>
      </section>

      <section className="landingSection landingHow">
        <div className="landingSectionTitle">
          <span className="pill mini">CARA KERJA</span>
          <h2>Mudah untuk user premium</h2>
        </div>

        <div className="landingSteps">
          <div><b>1</b><span>Daftar / login akun</span></div>
          <div><b>2</b><span>Aktifkan premium lewat support</span></div>
          <div><b>3</b><span>Hubungkan Notifikasi Telegram</span></div>
          <div><b>4</b><span>Pantau sinyal dan riwayat</span></div>
        </div>
      </section>

      <section className="landingSection" id="pricing">
        <div className="landingSectionTitle">
          <span className="pill mini">PAKET BETA</span>
          <h2>Pilih paket premium</h2>
          <p>Paket beta hemat untuk akses dashboard premium. Aktivasi premium diproses manual oleh tim XAU AI.</p>
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
            <h3>Akses Manual</h3>
            <b>Admin</b>
            <p>Aktivasi manual setelah pembayaran atau konfirmasi support.</p>
            <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Chat Support</a>
          </div>
        </div>
      </section>



      <section className="landingSection manualPaymentSection" id="payment">
        <div className="landingSectionTitle">
          <span className="pill mini">PEMBAYARAN MANUAL</span>
          <h2>Cara aktivasi premium</h2>
          <p>Pilih paket di atas, lakukan pembayaran, lalu kirim bukti bayar ke support. Premium akan diaktifkan manual setelah pembayaran dikonfirmasi.</p>
        </div>

        <div className="activationPaymentBox">
          <div className="paymentStepsBox">
            <b>Alur Aktivasi:</b>
            <span>1. Register akun dan verifikasi email.</span>
            <span>2. Pilih paket 7 Day atau 30 Day.</span>
            <span>3. Transfer / minta QRIS ke support.</span>
            <span>4. Kirim email akun + bukti bayar.</span>
            <span>5. Support mengaktifkan premium, lalu kamu bisa masuk dashboard.</span>
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
        <b>Catatan Risiko</b>
        <p>
          XAU AI Signal adalah alat bantu baca market dan asisten trading, bukan jaminan profit.
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
            <p>Bukan. Ini dashboard scanner dan alert. Eksekusi tetap manual oleh kamu.</p>
          </details>
          <details>
            <summary>Apakah pasti profit?</summary>
            <p>Tidak. Market gold sangat volatil. Sinyal membantu membaca setup, bukan menjamin hasil.</p>
          </details>
          <details>
            <summary>Apakah ada Telegram alert?</summary>
            <p>Ada. User premium bisa connect Telegram untuk menerima alert utama.</p>
          </details>
          <details>
            <summary>Bagaimana aktivasi premium?</summary>
            <p>Daftar akun, hubungi support, lalu premium akan diaktifkan sesuai paket.</p>
          </details>
        </div>
      </section>

      <footer className="landingFooter">
        <div>
          <b>XAU AI Signal</b>
          <span>Asisten market AI untuk XAUUSD.</span>
        </div>
        <button type="button" onClick={onLogin}>Masuk / Daftar</button>
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
              ? "Login dulu buat akses dashboard premium, SINYAL UTAMA, Main Signal M1, Risk Plan Jelas, dan history signal."
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
            {busy ? "Memuat..." : resetMode ? "Kirim Link Reset Password" : mode === "register" ? "Create Account" : "Login"}
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
            {busy ? "Memuat..." : "Kirim Ulang Link"}
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
          <span>✅ Alert Sinyal Utama</span>
          <span>✅ Main Signal M1</span>
          <span>✅ Risk Plan Jelas</span>
          <span>✅ CALL & SCALP History</span>
          <span>✅ Analisis Performa 7/30 Hari</span>
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
          <a href={ADMIN_CONTACT_URL} target="_blank" rel="noreferrer">Hubungi Support</a>
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

  // Step 10AM4: OB M15 tetap terlihat setelah disentuh.
  // Hilang hanya kalau invalid/deep break atau engine menemukan OB baru yang lebih relevan.
  if (ob.status && ob.status !== "active" && ob.status !== "mitigated") return null;

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
      title: `M5 Swing Low x${supportTouches || 1}`
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
      title: `M5 Swing High x${resistanceTouches || 1}`
    });
    newLines.push({ series, line });
  }

  linesRef.current = newLines;
}

function clearTradePlanLines(linesRef) {
  if (!linesRef.current) return;

  linesRef.current.forEach(({ series, line }) => {
    try {
      series.removePriceLine(line);
    } catch {}
  });

  linesRef.current = [];
}

function addTradePlanLines(series, linesRef, mainM5) {
  clearTradePlanLines(linesRef);

  const action = String(mainM5?.action || "Menunggu");
  const preview = mainM5?.preview || {};
  const isPlan = ["BUY_OPEN", "SELL_OPEN", "BUY_LIMIT", "SELL_LIMIT"].includes(action);
  const entry = Number((isPlan ? mainM5?.entry : preview?.entry) || 0);
  const pullbackPlan = mainM5?.pullbackLimitPlan || {};
  const limitEntry = Number(pullbackPlan?.limitEntry || mainM5?.limitEntry || 0);
  const sl = Number(mainM5?.sl || 0);
  const tp1 = Number(mainM5?.tp1 || 0);
  const tp2 = Number(mainM5?.tp2 || mainM5?.tp || 0);
  const limitTp1 = Number(pullbackPlan?.limitTp1 || pullbackPlan?.tp1 || 0);
  const limitTp2 = Number(pullbackPlan?.limitTp2 || pullbackPlan?.tp2 || 0);
  const direction = String((isPlan ? mainM5?.direction : preview?.direction) || "Menunggu");

  if (!isPlan && !preview?.active) return;
  if (!Number.isFinite(entry) || entry <= 0) return;

  const newLines = [];
  const entryLine = series.createPriceLine({
    price: entry,
    color: direction === "BUY" ? "#22c55e" : "#ef4444",
    lineWidth: isPlan ? 2 : 1,
    lineStyle: isPlan ? 0 : 1,
    axisLabelVisible: true,
    title: isPlan ? `${direction || "PLAN"} OPEN · EMA CROSS` : `${direction || "Menunggu"} PREVIEW · EMA CROSS`
  });
  newLines.push({ series, line: entryLine });

  if (isPlan && Number.isFinite(limitEntry) && limitEntry > 0 && Math.abs(limitEntry - entry) > 0.00001) {
    const limitLine = series.createPriceLine({
      price: limitEntry,
      color: "#f59e0b",
      lineWidth: 2,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `${direction || "PLAN"} LIMIT · PULLBACK EMA`
    });
    newLines.push({ series, line: limitLine });

    if (Number.isFinite(limitTp1) && limitTp1 > 0) {
      const limitTp1Line = series.createPriceLine({
        price: limitTp1,
        color: "#67e8f9",
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "LIMIT TP1 · BE"
      });
      newLines.push({ series, line: limitTp1Line });
    }

    if (Number.isFinite(limitTp2) && limitTp2 > 0) {
      const limitTp2Line = series.createPriceLine({
        price: limitTp2,
        color: "#facc15",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "LIMIT TP MAX 1:1"
      });
      newLines.push({ series, line: limitTp2Line });
    }
  }

  if (Number.isFinite(sl) && sl > 0) {
    const slLine = series.createPriceLine({
      price: sl,
      color: "#fb7185",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "SL"
    });
    newLines.push({ series, line: slLine });
  }

  if (Number.isFinite(tp1) && tp1 > 0) {
    const tp1Line = series.createPriceLine({
      price: tp1,
      color: "#38bdf8",
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: "TP1 · BE"
    });
    newLines.push({ series, line: tp1Line });
  }

  if (Number.isFinite(tp2) && tp2 > 0) {
    const tp2Line = series.createPriceLine({
      price: tp2,
      color: "#0ea5e9",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "TP MAX"
    });
    newLines.push({ series, line: tp2Line });
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
        <Metric label="Last Candle M5" value={formatBybitNumber(lastCandle?.close)} note={lastCandle?.time || "Menunggu candle"} />
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
          <RefreshCcw size={15} /> {feed?.loading ? "Memuat..." : "Refresh Backup Feed"}
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



function StrategyComparePanel({ callHistory, scalpHistory, strategyBHistory }) {
  const strategyAItems = (callHistory?.history || []).map((item) => ({
    ...item,
    compareSource: "SINYAL UTAMA"
  }));
  const scalpItems = (scalpHistory?.history || []).map((item) => ({
    ...item,
    compareSource: "SCALP M5"
  }));
  const strategyBItems = strategyBHistory?.history || [];

  const a7 = buildCompareStats(strategyAItems, 7, 1.25);
  const a30 = buildCompareStats(strategyAItems, 30, 1.25);
  const scalp7 = buildCompareStats(scalpItems, 7, 1.25);
  const scalp30 = buildCompareStats(scalpItems, 30, 1.25);
  const b7 = buildCompareStats(strategyBItems, 7, 2);
  const b30 = buildCompareStats(strategyBItems, 30, 2);
  const insight = buildStrategyCompareInsight3Way(a7, a30, scalp7, scalp30, b7, b30);
  const cards = [
    { key: "main", title: "Strategi A", subtitle: "Sinyal Utama Saja", stats7: a7, stats30: a30, tone: "a" },
    { key: "scalp", title: "M5 Scalp", subtitle: "Mode terpisah · Engulfing Limit M5", stats7: scalp7, stats30: scalp30, tone: "scalp" },
    { key: "smc", title: "Strategi B", subtitle: "SMC AI · OB → Sweep → CHOCH → EMA", stats7: b7, stats30: b30, tone: "b" }
  ];

  return (
    <section className="strategyComparePanel card">
      <div className="sectionTitle">
        <div>
          <span className="pill mini"><BarChart3 size={14} /> STRATEGY LAB</span>
          <h3>Perbandingan 3 Mode</h3>
          <span>Panel ini membandingkan Sinyal Utama, Scalp M1, dan SMC AI secara terpisah agar statistik tidak tercampur.</span>
        </div>
        <div className="strategyCompareBadge">
          <b>{insight.badge}</b>
          <span>{insight.short}</span>
        </div>
      </div>

      <div className="strategyCompareGrid threeWay">
        {cards.map((card) => (
          <StrategyCompareCard key={card.key} {...card} />
        ))}
      </div>

      <div className="strategyCompareTable threeWay">
        <div className="strategyCompareHead threeWay">
          <span>Metric</span>
          <span>Main Sinyal</span>
          <span>M5 Scalp</span>
          <span>SMC AI</span>
          <span>Insight</span>
        </div>
        {buildStrategyCompareRows3Way(a30, scalp30, b30).map((row) => (
          <div className="strategyCompareRow threeWay" key={row.metric}>
            <span>{row.metric}</span>
            <b>{row.a}</b>
            <b>{row.scalp}</b>
            <b>{row.b}</b>
            <em>{row.note}</em>
          </div>
        ))}
      </div>

      <div className="strategyCompareInsight">
        <b>AI Lab Insight</b>
        <span>{insight.detail}</span>
      </div>

      <div className="strategyCompareNote">
        <b>Mode tetap terpisah</b>
        <span>Sinyal Utama tetap Strategi A. Scalp M1 tetap mode terpisah. SMC AI tetap Strategi B dalam uji live. Panel ini hanya untuk membandingkan performa, bukan menggabungkan strategi.</span>
        <em>Data 30H: Utama {a30.total} sinyal · Scalp {scalp30.total} sinyal · SMC {b30.total} sinyal</em>
      </div>
    </section>
  );
}

function StrategyCompareCard({ title, subtitle, stats7, stats30, tone }) {
  const wrClass = stats30.cleanWinRate >= 70 ? "strong" : stats30.cleanWinRate >= 50 ? "normal" : "weak";
  return (
    <div className={`strategyCompareCard ${tone}`}>
      <div className="strategyCompareCardTop">
        <div>
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
        <strong className={wrClass}>{stats30.cleanWinRate}%</strong>
      </div>
      <div className="strategyCompareMiniGrid">
        <span>7D WR <b>{stats7.cleanWinRate}%</b></span>
        <span>30D WR <b>{stats30.cleanWinRate}%</b></span>
        <span>Signal <b>{stats30.total}</b></span>
        <span>Selesai <b>{stats30.closed}</b></span>
        <span>Expired <b>{stats30.expired}</b></span>
        <span>Avg RR <b>{stats30.averageRR}</b></span>
      </div>
      <p>{stats30.total ? `${stats30.wins} Menang · ${stats30.losses} Kalah · ${stats30.be} BE · ${stats30.expired} Exp dalam 30 hari.` : "Menunggu data hasil 30 hari."}</p>
    </div>
  );
}

function buildCompareStats(items, days, fallbackRR = 1) {
  const stats = buildPerformanceStats(items, days);
  const filtered = filterHistoryByDays(items, days);
  const closedItems = filtered.filter((item) => ["Menang", "Kalah", "BE"].includes(formatResultStatus(item)));
  const rrValues = closedItems.map((item) => Number(String(item.rr || item.riskReward || fallbackRR).replace(/[^0-9.]/g, ""))).filter((n) => Number.isFinite(n) && n > 0);
  const tpValues = closedItems.map((item) => Math.abs(Number(item.tp || 0) - Number(item.entry || 0))).filter((n) => Number.isFinite(n) && n > 0);
  const slValues = closedItems.map((item) => Math.abs(Number(item.entry || 0) - Number(item.sl || 0))).filter((n) => Number.isFinite(n) && n > 0);
  const avgRR = rrValues.length ? average(rrValues) : fallbackRR;
  const avgTP = tpValues.length ? average(tpValues) : 0;
  const avgRisiko = slValues.length ? average(slValues) : 0;
  const grossWin = stats.wins * avgRR;
  const grossLoss = stats.losses || 0;

  return {
    ...stats,
    averageRR: avgRR ? Number(avgRR.toFixed(2)) : 0,
    averageTP: avgTP ? Number(avgTP.toFixed(2)) : 0,
    averageSL: avgRisiko ? Number(avgSL.toFixed(2)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : stats.wins > 0 ? "∞" : 0,
    expiredRate: stats.total > 0 ? Math.round((stats.expired / stats.total) * 100) : 0
  };
}

function filterHistoryByDays(items, days) {
  const now = Date.now();
  const from = now - days * 24 * 60 * 60 * 1000;
  return (items || []).filter((item) => {
    const t = parseHistoryTimeMs(item.createdAt || item.candleTime || item.time || item.timestamp || item.closedAt || item.resultAt);
    if (!t) return true;
    return t >= from;
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function buildStrategyCompareRows3Way(a, scalp, b) {
  return [
    {
      metric: "WR Bersih 30D",
      a: `${a.cleanWinRate}%`,
      scalp: `${scalp.cleanWinRate}%`,
      b: `${b.cleanWinRate}%`,
      note: compareBest3Way(a.cleanWinRate, scalp.cleanWinRate, b.cleanWinRate, "WR Bersih")
    },
    {
      metric: "Total Sinyal",
      a: String(a.total),
      scalp: String(scalp.total),
      b: String(b.total),
      note: b.total < 5 ? "SMC AI masih butuh data lebih banyak." : "Sample Strategi B mulai bisa dibandingkan."
    },
    {
      metric: "Average RR",
      a: String(a.averageRR),
      scalp: String(scalp.averageRR),
      b: String(b.averageRR),
      note: compareBest3Way(Number(a.averageRR) || 0, Number(scalp.averageRR) || 0, Number(b.averageRR) || 0, "RR")
    },
    {
      metric: "Expired Rate",
      a: `${a.expiredRate}%`,
      scalp: `${scalp.expiredRate}%`,
      b: `${b.expiredRate}%`,
      note: "Expired lebih kecil biasanya lebih sehat, tapi tetap cek kualitas setup."
    },
    {
      metric: "Profit Factor",
      a: String(a.profitFactor),
      scalp: String(scalp.profitFactor),
      b: String(b.profitFactor),
      note: "PF adalah estimasi sederhana dari result closed."
    }
  ];
}

function compareBest3Way(a, scalp, b, label) {
  const values = [
    { name: "Main Signal", value: Number(a) || 0 },
    { name: "M5 Scalp", value: Number(scalp) || 0 },
    { name: "SMC AI", value: Number(b) || 0 }
  ];
  const best = values.reduce((top, item) => (item.value > top.value ? item : top), values[0]);
  if (values.every((item) => item.value === best.value)) return `${label} ketiganya seimbang.`;
  return `${best.name} unggul di ${label}.`;
}

function buildStrategyCompareInsight3Way(a7, a30, scalp7, scalp30, b7, b30) {
  const totalSamples = a30.total + scalp30.total + b30.total;
  if (totalSamples < 5) {
    return {
      badge: "Data awal",
      short: "Belum cukup data",
      detail: "Main Signal, M5 Scalp, dan SMC AI masih perlu lebih banyak closed signal sebelum keputusan performa bisa dipercaya."
    };
  }

  if (b30.total < 5) {
    return {
      badge: "SMC AI Testing",
      short: "Data Strategi B masih tipis",
      detail: `SMC AI baru punya ${b30.total} signal 30D. Main Signal dan M5 Scalp tetap jadi pembanding sambil SMC AI live-backtest mengumpulkan data.`
    };
  }

  if (b30.cleanWinRate >= a30.cleanWinRate && b30.cleanWinRate >= scalp30.cleanWinRate && b30.averageRR >= Math.max(a30.averageRR, scalp30.averageRR)) {
    return {
      badge: "SMC AI unggul",
      short: "B kuat di WR/RR",
      detail: `SMC AI unggul dengan ${b30.cleanWinRate}% WR Bersih dan Avg RR ${b30.averageRR}. Tetap pantau sample size dan expired rate sebelum live alert ke user premium.`
    };
  }

  if (scalp30.total >= a30.total && scalp30.cleanWinRate >= a30.cleanWinRate && scalp30.cleanWinRate >= b30.cleanWinRate) {
    return {
      badge: "Scalp aktif",
      short: "M5 paling aktif",
      detail: `M5 Scalp paling aktif dengan ${scalp30.total} signal 30D dan WR Bersih ${scalp30.cleanWinRate}%. Tetap pisahkan dari Strategi A agar statistik utama tidak tercampur.`
    };
  }

  if (a30.total >= b30.total && a30.total >= scalp30.total) {
    return {
      badge: "Main stabil",
      short: "A jadi baseline",
      detail: `Main Signal masih cocok jadi baseline utama karena sample 30D paling stabil. SMC AI dan M5 Scalp tetap lanjut sebagai pembanding terpisah.`
    };
  }

  return {
    badge: "Mixed result",
    short: "Perlu observasi lanjut",
    detail: "Ketiga mode punya karakter berbeda. Pakai panel ini untuk memilih strategi mana yang paling layak masuk alert premium live."
  };
}

function StrategyBSmcPanel({ strategyB, strategyBHistory, isAdmin, onUpdateResult }) {
  const action = String(strategyB?.action || "Menunggu");
  const tone = action.includes("BUY") ? "buy" : action.includes("SELL") ? "sell" : action.includes("READY") ? "ready" : "wait";
  const checks = Array.isArray(strategyB?.checklist) ? strategyB.checklist : [];
  const direction = strategyB?.direction || "Menunggu";
  const active = direction === "SELL" ? strategyB?.sell : strategyB?.buy;
  const activeSteps = active?.steps || {};
  const smcHistory = strategyBHistory?.history || [];
  const smcStats = strategyBHistory?.stats || {};
  const smcWindows = smcStats?.windows || {};
  const smc7d = smcWindows.d7 || smcStats;
  const smc30d = smcWindows.d30 || smcStats;
  const smcBest = smcStats?.bestSnapshot || {
    title: "Menunggu data",
    detail: "SMC AI belum punya data selesai yang cukup untuk highlight."
  };

  return (
    <section className={`strategyBPanel card ${tone}`}>
      <div className="strategyHeader">
        <div>
          <span className="pill mini"><Sparkles size={14} /> STRATEGY B · LIVE BACKTEST</span>
          <h3>{strategyB?.label || "SMC AI Menunggu"}</h3>
          <p>{strategyB?.reason || "Menunggu rangkaian SMC."}</p>
        </div>
        <div className={`biasBadge ${tone}`}>{strategyB?.confidence || 0}% kekuatan setup</div>
      </div>

      <div className="strategyBNotice">
        Strategi B berjalan paralel sebagai eksperimen/live-backtest. Strategi A tidak diubah, tidak diganti, dan statistiknya tetap terpisah.
      </div>

      <div className="scalpGrid strategyBGrid">
        <Metric label="Entry" value={strategyB?.entry || "-"} note="Harga acuan saat setup SMC valid" />
        <Metric label="Stop Loss" value={strategyB?.sl || "-"} note="BUY: Sweep Low - 1.5 ATR · SELL: Sweep High + 1.5 ATR" />
        <Metric label="Take Profit" value={strategyB?.tp || "-"} note={`RR tetap ${strategyB?.rr || "1:2"}`} />
        <Metric label="Direction" value={direction} note="Arah kandidat terbaik dari SMC AI" />
        <Metric label="Mode" value="Uji Live" note="Belum menggantikan Strategi A" />
      </div>

      <div className="strategyBFlow card">
        <h4>SMC Flow</h4>
        <div className="strategyBSteps">
          {checks.map((item, idx) => {
            const passed = direction === "SELL" ? item.sell : item.buy;
            return (
              <div key={`${item.name}-${idx}`} className={`strategyBStep ${passed ? "pass" : "wait"}`}>
                <b>{item.name}</b>
                <span>{passed ? "YES" : "Menunggu"}</span>
              </div>
            );
          })}
        </div>
        {strategyB?.blockers?.length > 0 && <p className="strategyBBlocker">Menunggu: {strategyB.blockers.slice(0, 2).join(" · ")}</p>}
      </div>

      <div className="strategyBDetails">
        <div className="strategyBDetailCard">
          <b>BUY Checklist</b>
          <span>OB {strategyB?.buy?.steps?.freshOb ? "YES" : "Menunggu"} · Sweep {strategyB?.buy?.steps?.sweep ? "YES" : "Menunggu"} · CHOCH {strategyB?.buy?.steps?.choch ? "YES" : "Menunggu"} · EMA {strategyB?.buy?.steps?.ema ? "YES" : "Menunggu"}</span>
          <em>Score {strategyB?.buy?.score || 0}%</em>
        </div>
        <div className="strategyBDetailCard">
          <b>SELL Checklist</b>
          <span>OB {strategyB?.sell?.steps?.freshOb ? "YES" : "Menunggu"} · Sweep {strategyB?.sell?.steps?.sweep ? "YES" : "Menunggu"} · CHOCH {strategyB?.sell?.steps?.choch ? "YES" : "Menunggu"} · EMA {strategyB?.sell?.steps?.ema ? "YES" : "Menunggu"}</span>
          <em>Score {strategyB?.sell?.score || 0}%</em>
        </div>
      </div>

      <section className="strategyBHistory card">
        <div className="sectionTitle">
          <div>
            <span className="pill mini"><Clock size={14} /> SMC AI LIVE BACKTEST</span>
            <h3>Strategi B History</h3>
            <span>Riwayat ini terpisah dari sinyal utama dan hanya untuk pemantauan performa.</span>
          </div>
          <div className="historyStats smcStats">
            <b>Total {smcStats.total || 0}</b>
            <b>Running {smcStats.open || 0}</b>
            <b>Win {smcStats.wins || 0}</b>
            <b>Loss {smcStats.losses || 0}</b>
            <b>Exp {smcStats.expired || 0}</b>
            <em>WR {smcStats.winRate || 0}%</em>
          </div>
        </div>

        <div className="strategyBAnalyticsHero">
          <div>
            <span className="pill mini"><BarChart3 size={14} /> SMC AI ANALYTICS</span>
            <h4>{smcBest.title}</h4>
            <p>{smcBest.detail}</p>
          </div>
          <div className="strategyBAnalyticsSumber Data">
            <b>Live Gold Feed</b>
            <span>Hasil SMC AI tetap memakai koneksi market utama, bukan data cadangan.</span>
          </div>
        </div>

        <div className="strategyBWindowGrid">
          <StrategyBWindowStats title="7 Hari" stats={smc7d} />
          <StrategyBWindowStats title="30 Hari" stats={smc30d} />
        </div>

        <div className="strategyBStatsGrid">
          <Metric label="Average RR" value={smcStats.averageRR || "-"} note="Rata-rata reward/risk dari sinyal selesai" />
          <Metric label="Average TP" value={smcStats.averageTP || "-"} note="All-time rata-rata jarak TP SMC AI" />
          <Metric label="Average Risiko" value={smcStats.averageRisiko || "-"} note="All-time rata-rata jarak Risiko SMC AI" />
          <Metric label="Profit Factor" value={smcStats.profitFactor || "-"} note="All-time estimasi gross reward vs risk" />
          <Metric label="Auto Result" value="MT5/VPS" note="Hasil SMC AI dipantau dari koneksi market utama" />
        </div>

        <div className="historyTable strategyBHistoryTable">
          <div className={`historyHead ${isAdmin ? "adminMode" : "viewerMode"}`}>
            <span>Waktu</span>
            <span>Sinyal</span>
            <span>Harga Masuk</span>
            <span>Risiko / Target</span>
            <span>Conf</span>
            <span>Hasil</span>
            {isAdmin && <span>Aksi</span>}
          </div>

          {smcHistory.slice(0, 12).map((item) => (
            <div className={`historyRow ${isAdmin ? "adminMode" : "viewerMode"}`} key={item.id}>
              <span>{formatHistoryTime(item.createdAt || item.candleTime)}</span>
              <strong className={String(item.signal || "").toLowerCase()}>{item.signal}</strong>
              <span>{item.entry}</span>
              <span>{item.sl || "-"} / {item.tp || "-"}</span>
              <span>{item.confidence ?? item.score ?? "-"}%</span>
              <span className={`resultBadge ${getResultStatusTone(item)}`}>{formatResultStatus(item)}</span>
              {isAdmin && (
                <div className="historyActions">
                  <button type="button" onClick={() => onUpdateResult?.(item.id, "WIN")}>Menang</button>
                  <button type="button" onClick={() => onUpdateResult?.(item.id, "LOSS")}>Kalah</button>
                  <button type="button" onClick={() => onUpdateResult?.(item.id, "BE")}>BE</button>
                  <button type="button" onClick={() => onUpdateResult?.(item.id, "EXPIRED")}>Exp</button>
                  <button type="button" onClick={() => onUpdateResult?.(item.id, "OPEN")}>Berjalan</button>
                </div>
              )}
            </div>
          ))}

          {smcHistory.length === 0 && (
            <div className="emptyHistory">Belum ada BUY/SELL dari SMC AI. Riwayat akan muncul otomatis saat OB → Sweep → CHOCH → EMA lengkap.</div>
          )}
        </div>
      </section>
    </section>
  );
}

function StrategyBWindowStats({ title, stats }) {
  const safe = stats || {};
  return (
    <div className="strategyBWindowCard">
      <div className="strategyBWindowTop">
        <b>{title}</b>
        <span>WR Bersih {safe.winRate || 0}%</span>
      </div>
      <div className="strategyBWindowMetrics">
        <span>Total <b>{safe.total || 0}</b></span>
        <span>Run <b>{safe.open ?? safe.running ?? 0}</b></span>
        <span>Menang <b>{safe.wins || 0}</b></span>
        <span>Kalah <b>{safe.losses || 0}</b></span>
        <span>Exp <b>{safe.expired || 0}</b></span>
        <span>WR Total <b>{safe.totalWinRate || 0}%</b></span>
        <span>Avg RR <b>{safe.averageRR || 0}</b></span>
        <span>PF <b>{safe.profitFactor || 0}</b></span>
      </div>
      <p>Sinyal berjalan tidak masuk hitungan winrate bersih. Kedaluwarsa tetap dihitung agar uji live SMC AI jujur.</p>
    </div>
  );
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


function SignalQualityGuardPanel({ guard }) {
  if (!guard) return null;

  const tone = guard.status === "SAFE" ? "safe" : guard.status === "CAUTION" ? "caution" : "wait";
  const checks = Array.isArray(guard.checks) ? guard.checks : [];
  const blockers = Array.isArray(guard.blockers) ? guard.blockers : [];
  const metrics = guard.metrics || {};
  const isAllowed = guard.decision === "CALL_ALLOWED" || guard.allowCall === true || guard.status === "SAFE";
  const cleanChecks = checks.map((item) => ({
    ...item,
    passed: isQualityCheckPass(item),
    displayStatus: formatQualityCheckStatus(item)
  }));

  return (
    <section className={`qualityGuardPanel card ${tone}`}>
      <div className="qualityGuardTop">
        <div>
          <span className="pill mini"><Shield size={14} /> CEK MARKET</span>
          <h3>{guard.label || "Kondisi Market"}</h3>
          <p>{guard.message || "Sistem mengecek kualitas market sebelum sinyal premium ditampilkan."}</p>
        </div>
        <div className={`qualityGuardScore ${tone}`}>
          <b>{guard.score ?? 0}%</b>
          <span>{isAllowed ? "Sinyal layak tampil" : "Menunggu setup valid"}</span>
        </div>
      </div>

      <div className="qualityGuardChecks">
        {cleanChecks.map((item, idx) => (
          <div key={`${item.name}-${idx}`} className={`qualityGuardCheck ${item.passed ? "pass" : "wait"}`}>
            <b>{formatQualityCheckName(item.name)}</b>
            <strong>{item.displayStatus}</strong>
            <span>{formatChecklistText(item.note)}</span>
          </div>
        ))}
      </div>

      <div className="qualityGuardFooter">
        <div>
          <b>{blockers.length ? "Perlu ditunggu:" : "Status:"}</b> {blockers.length ? blockers.slice(0, 4).map(formatChecklistText).join(" · ") : "Semua data utama sudah pas."}
        </div>
        <div>
          <b>Detail:</b> Spread {metrics.spread ?? "-"} / max {metrics.maxSpread ?? "-"} · ATR {metrics.atr14 ?? "-"} · Feed {formatAgeCompact(metrics.feedAgeSec)}
        </div>
      </div>
    </section>
  );
}

function isQualityCheckPass(item = {}) {
  const raw = String(item.status || item.value || "").toUpperCase();
  return ["PASS", "PAS", "LOLOS", "VALID", "OK", "SAFE"].includes(raw);
}

function formatQualityCheckStatus(item = {}) {
  const raw = String(item.status || item.value || "").toUpperCase();
  if (["PASS", "PAS", "LOLOS", "VALID", "OK", "SAFE"].includes(raw)) return "Pas";
  if (["FAIL", "BLOCK", "BLOCKED", "DANGER"].includes(raw)) return "Belum pas";
  if (["CAUTION", "WARN", "WARNING"].includes(raw)) return "Hati-hati";
  return "Pantau";
}

function formatQualityCheckName(name) {
  const raw = String(name || "");
  return raw
    .replaceAll("Direct Entry Plan", "Rencana Entry")
    .replaceAll("Kekuatan Setup", "Kualitas Setup")
    .replaceAll("Data Live", "Live Feed")
    .replaceAll("Setup", "Validasi Setup");
}

function formatAgeCompact(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  const sec = Number(seconds);
  if (!Number.isFinite(sec)) return "-";
  if (sec < 60) return `${Math.round(sec)} detik`;
  if (sec < 3600) return `${Math.round(sec / 60)} menit`;
  return `${Math.round(sec / 3600)} jam`;
}

function formatPremiumAction(action) {
  const raw = String(action || "WAIT").toUpperCase();
  if (raw === "BUY_OPEN") return "BUY aktif";
  if (raw === "SELL_OPEN") return "SELL aktif";
  if (raw === "READY_BUY") return "Pantau BUY";
  if (raw === "READY_SELL") return "Pantau SELL";
  return "Menunggu";
}

function formatPremiumStrength(label, score) {
  const raw = String(label || "LOW").toUpperCase();
  const num = Number(score || 0);
  if (raw === "HIGH" || num >= 80) return "Kuat";
  if (raw === "MEDIUM" || num >= 65) return "Cukup kuat";
  return "Belum kuat";
}

function formatPremiumChecklistStatus(status) {
  const raw = String(status || "WAIT").toUpperCase();
  if (raw === "PASS" || raw === "VALID" || raw === "OK") return "lolos";
  if (raw === "FAIL" || raw === "BLOCK") return "belum lolos";
  return "menunggu";
}

function formatChecklistText(item) {
  if (item === null || item === undefined) return "-";
  if (["string", "number", "boolean"].includes(typeof item)) {
    return String(item)
      .replaceAll("READY_BUY", "Pantau BUY")
      .replaceAll("READY_SELL", "Pantau SELL")
      .replaceAll("BUY_OPEN", "BUY aktif")
      .replaceAll("SELL_OPEN", "SELL aktif")
      .replaceAll("HIGH", "Kuat")
      .replaceAll("MEDIUM", "Cukup kuat")
      .replaceAll("LOW", "Belum kuat")
      .replaceAll("WAIT", "Menunggu")
      .replaceAll("PASS", "Lolos");
  }
  if (typeof item === "object") {
    const name = item.name || item.title || item.label || item.id || "Checklist";
    const status = item.status || item.value || item.note || "";
    return status ? `${name}: ${formatPremiumChecklistStatus(status)}` : String(name);
  }
  return String(item);
}

function SnapshotRow({ row, defaultOpen = false }) {
  const valueText = formatChecklistText(row.value || "-");
  const statusText = formatChecklistText(row.status || "Menunggu");
  return (
    <details className="snapshotRow" open={defaultOpen}>
      <summary>
        <span className="snapshotRowTitle">{row.title}</span>
        <span className="snapshotRowValue" title={valueText}>{valueText}</span>
        <span className="snapshotRowStatus">{statusText}</span>
      </summary>
      <div className="snapshotRowBody">
        <p>{formatChecklistText(row.note || "Menunggu data.")}</p>
        <small>{formatChecklistText(row.detail)}</small>
      </div>
    </details>
  );
}
function humanize(value) { if (!value) return "-"; return String(value).replaceAll("_", " "); }
function formatAiText(text) { return String(text).split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>); }
