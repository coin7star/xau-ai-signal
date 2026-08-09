import { useEffect, useMemo, useState } from "react";
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from "firebase/auth";
import {
  Activity, ArrowLeft, Bell, Bot, CheckCircle2, Clock3, Copy, Crown, LayoutDashboard, LogIn,
  LogOut, Megaphone, Menu, Radio, RefreshCw, Send, Shield, Sparkles, Target, TrendingDown,
  TrendingUp, User, Users, Wallet, X, Zap
} from "lucide-react";
import Landing from "./Landing";
import {
  auth,
  createPaymentOrder,
  getUserPaymentOrders,
  getUserProfile,
  hasFirebaseClientConfig,
  isPremiumProfile,
  listenAuth,
  loginWithEmail,
  loginWithGoogle,
  logout,
  refreshCurrentUser,
  registerWithEmail,
  resetPasswordEmail,
  sendVerificationEmail
} from "./firebaseClient";

const APP_NAME = "XAU AI SIGNAL";
const APP_URL = "https://www.xauaisignal.online";
const ADMIN_TOKEN_KEY = "xau_admin_token";

function money(v) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function isBuy(s) { return String(s || "").toUpperCase().includes("BUY"); }
function isSell(s) { return String(s || "").toUpperCase().includes("SELL"); }
function resultBadgeClass(r) { const v=String(r||"").toUpperCase(); return v==="WIN"?"resultBadge win":v==="LOSS"?"resultBadge loss":v==="BE"?"resultBadge be":""; }
function resultLabel(r) { const v=String(r||"").toUpperCase(); return v==="WIN"?"✅ WIN":v==="LOSS"?"❌ LOSS":v==="BE"?"➖ BE":""; }
function statusBadgeClass(s) { const v=String(s||"").toUpperCase(); return v==="CANCELLED"?"resultBadge cancelled":v==="CLOSED"?"resultBadge closed":""; }
function statusLabel(s) { const v=String(s||"").toUpperCase(); return v==="CANCELLED"?"🚫 CANCELLED":v==="CLOSED"?"⏹ CLOSED":""; }

function AuthScreen({ onDone, onBack }) {
  const [mode,setMode] = useState("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "login") await loginWithEmail(email.trim(), password);
      else if (mode === "register") await registerWithEmail(email.trim(), password);
      else await resetPasswordEmail(email.trim());
      if (mode === "reset") {
        setError("Link reset sudah dikirim. Cek email kamu.");
      } else onDone();
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan.");
    } finally { setBusy(false); }
  }

  return <main className="authShell">
    <div className="authGlow" />
    {onBack && <button className="backToLanding" onClick={onBack}><ArrowLeft size={15}/> Kembali ke Beranda</button>}
    <section className="authCard newCard">
      <div className="brandMark">X</div>
      <div className="eyebrow">XAUUSD • SIGNAL DESK</div>
      <h1>Trading lebih simpel.<br/><span>Sinyal lebih jelas.</span></h1>
      <p className="muted">Dashboard khusus informasi sinyal XAUUSD, insight AI, dan alert premium.</p>
      <form onSubmit={submit} className="authForm">
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="nama@email.com"/></label>
        {mode !== "reset" && <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={6} placeholder="••••••••"/></label>}
        {error && <div className={error.includes("dikirim") ? "notice ok" : "notice error"}>{error}</div>}
        <button className="primaryBtn" disabled={busy}>{busy ? "Memproses..." : mode==="login" ? "Masuk ke Signal Desk" : mode==="register" ? "Buat Akun" : "Kirim Link Reset"}</button>
      </form>
      <div className="authLinks">
        <button onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}</button>
        <button onClick={()=>setMode("reset")}>Lupa password?</button>
      </div>
      {hasFirebaseClientConfig && mode==="login" && <button className="googleBtn" onClick={async()=>{try{await loginWithGoogle();onDone()}catch(e){setError(e?.message||"Google login gagal.")}}}><LogIn size={17}/> Lanjut dengan Google</button>}
    </section>
  </main>;
}

function EmailVerifyScreen({ user, onVerified }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Cek inbox (atau folder spam) di " + (user?.email || "email kamu") + " dan klik link verifikasi yang sudah dikirim.");
  const [isError, setIsError] = useState(false);

  async function checkAgain() {
    setBusy(true); setIsError(false);
    try {
      const refreshed = await refreshCurrentUser();
      if (refreshed?.emailVerified) {
        onVerified();
      } else {
        setMessage("Email belum terverifikasi. Buka link di email kamu dulu, baru klik \"Saya sudah verifikasi\" lagi.");
        setIsError(true);
      }
    } catch (err) {
      setMessage(err?.message || "Gagal mengecek status verifikasi.");
      setIsError(true);
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setIsError(false);
    try {
      await sendVerificationEmail(user);
      setMessage("Email verifikasi baru sudah dikirim. Cek inbox kamu.");
    } catch (err) {
      setMessage(err?.message || "Gagal mengirim ulang email verifikasi.");
      setIsError(true);
    } finally { setBusy(false); }
  }

  return <main className="authShell">
    <div className="authGlow" />
    <section className="authCard newCard">
      <div className="brandMark">X</div>
      <div className="eyebrow">VERIFIKASI EMAIL</div>
      <h1>Satu langkah lagi.<br/><span>Verifikasi email kamu.</span></h1>
      <p className="muted">{message}</p>
      {isError && <div className="notice error">{message}</div>}
      <button className="primaryBtn" disabled={busy} onClick={checkAgain}>{busy ? "Mengecek..." : "Saya sudah verifikasi"}</button>
      <div className="authLinks">
        <button disabled={busy} onClick={resend}>Kirim ulang email verifikasi</button>
        <button onClick={logout}>Ganti akun / Keluar</button>
      </div>
    </section>
  </main>;
}

function SignalCard({ signal, premium }) {
  if (!signal) return <section className="heroSignal newCard emptySignal"><Clock3/><div><b>Belum ada sinyal manual</b><span>Admin akan menerbitkan setup berikutnya di sini.</span></div></section>;
  const buy=isBuy(signal.direction), sell=isSell(signal.direction);
  return <section className={`heroSignal newCard ${buy?"buy":sell?"sell":"neutral"}`}>
    <div className="signalHead">
      <div><span className="eyebrow">LATEST CALL</span><h2>{signal.direction || "WAIT"}</h2></div>
      <div className="liveBadge"><span/> LIVE FEED</div>
    </div>
    <div className="signalMeta">
      <span>{signal.pair || "XAUUSD"}</span><span>{signal.timeframe || "M15"}</span><span>{signal.status || "OPEN"}</span>
      {signal.result ? <span className={resultBadgeClass(signal.result)}>{resultLabel(signal.result)}</span> : (signal.status==="CLOSED"||signal.status==="CANCELLED") && <span className={statusBadgeClass(signal.status)}>{statusLabel(signal.status)}</span>}
    </div>
    <div className="priceGrid">
      <div><small>ENTRY</small><strong>{money(signal.entry)}</strong></div>
      <div><small>STOP LOSS</small><strong>{money(signal.sl)}</strong></div>
      <div><small>TAKE PROFIT</small><strong>{money(signal.tp)}</strong></div>
      <div><small>CONFIDENCE</small><strong>{signal.confidence ? `${signal.confidence}%` : "-"}</strong></div>
    </div>
    <div className="signalNote">{signal.note || signal.reason || "Setup sudah dianalisa manual oleh admin."}</div>
    {signal.closeReason && <div className="closeReasonNote"><b>{signal.status==="CANCELLED"?"Alasan dibatalkan:":"Alasan ditutup:"}</b> {signal.closeReason}</div>}
    <div className="signalFooter">
      <span>Dipublish {fmtDate(signal.publishedAt || signal.createdAt)}</span>
      {premium ? <span className="premiumMini"><Crown size={13}/> Premium Alert ON</span> : <span>Premium untuk alert Telegram</span>}
    </div>
  </section>;
}

function Feed({ history, onRefresh, admin, onSetResult, busyResultId }) {
  const [expanded,setExpanded]=useState(false);
  const visible = expanded ? history : history.slice(0,5);
  return <section className="section">
    <div className="sectionHeader"><div><span className="eyebrow">SIGNAL FEED</span><h3>Riwayat call</h3></div><button className="iconBtn" onClick={onRefresh}><RefreshCw size={17}/></button></div>
    <div className={`feedList ${expanded?"scrollable":""}`}>
      {visible.length ? visible.map((s,i)=><article className="feedItem" key={s.id || i}>
        <div className={`dir ${isBuy(s.direction)?"buy":isSell(s.direction)?"sell":""}`}>{s.direction || "WAIT"}</div>
        <div className="feedMain"><b>{s.title || `${s.pair || "XAUUSD"} ${s.timeframe || "M15"}`}</b><span>{s.note || s.reason || "Manual setup"}</span>{s.closeReason && <span className="feedCloseReason">{s.status==="CANCELLED"?"🚫":"⏹"} {s.closeReason}</span>}</div>
        <div className="feedNums"><b>{money(s.entry)}</b><span>SL {money(s.sl)} • TP {money(s.tp)}</span></div>
        <div className="feedResultCol">
          {s.result ? <span className={resultBadgeClass(s.result)}>{resultLabel(s.result)}</span> : (s.status==="CLOSED"||s.status==="CANCELLED") && <span className={statusBadgeClass(s.status)}>{statusLabel(s.status)}</span>}
          {admin && s.id && <div className="feedResultActions">
            <button type="button" title="Tandai TP / WIN" disabled={busyResultId===s.id} className="miniBtn win" onClick={()=>onSetResult(s.id,"WIN")}><CheckCircle2 size={13}/></button>
            <button type="button" title="Tandai SL / LOSS" disabled={busyResultId===s.id} className="miniBtn loss" onClick={()=>onSetResult(s.id,"LOSS")}><X size={13}/></button>
            <button type="button" title="Tandai Break Even" disabled={busyResultId===s.id} className="miniBtn be" onClick={()=>onSetResult(s.id,"BE")}><Target size={13}/></button>
          </div>}
        </div>
        <time>{fmtDate(s.publishedAt || s.createdAt)}</time>
      </article>) : <div className="emptyBox">Belum ada riwayat sinyal.</div>}
    </div>
    {history.length>5 && <button type="button" className="feedToggleBtn" onClick={()=>setExpanded(v=>!v)}>
      {expanded ? "Tampilkan lebih sedikit" : `Lihat semua (${history.length})`}
    </button>}
  </section>;
}

function WinrateCard({ stats }) {
  if (!stats) return null;
  const pipSign = (stats.totalPip||0)>=0?"+":"";
  return <section className="adminSection newCard winrateCard">
    <div className="sectionHeader"><div><span className="eyebrow">PERFORMANCE</span><h3>Winrate Signal Manual</h3></div><Target size={20}/></div>
    <div className="winrateGrid">
      <div className="winrateBig"><b>{stats.winratePercent}%</b><span>Winrate</span></div>
      <div className="winrateStat win"><b>{stats.wins}</b><span>WIN</span></div>
      <div className="winrateStat loss"><b>{stats.losses}</b><span>LOSS</span></div>
      <div className="winrateStat be"><b>{stats.be}</b><span>BE</span></div>
      <div className="winrateStat total"><b>{stats.total}</b><span>Total Call</span></div>
      <div className="winrateStat pip"><b>{pipSign}{stats.totalPip||0}</b><span>Total Pip</span></div>
    </div>
    <p className="muted" style={{marginTop:10,fontSize:13}}>Winrate dihitung dari WIN / (WIN + LOSS), tidak termasuk BE. Pip dihitung dari selisih Entry-TP (WIN) / Entry-SL (LOSS) × 10 (1$ XAUUSD = 10 pip). Update tiap kali admin menandai hasil di panel atau feed.</p>
  </section>;
}

function AiPanel({ signal }) {
  const [open,setOpen]=useState(true);
  const direction=signal?.direction || "WAIT";
  const text = signal ? `Bias manual terbaru adalah ${direction}. Entry ${money(signal.entry)}, SL ${money(signal.sl)}, TP ${money(signal.tp)}. AI di dashboard diposisikan sebagai asisten untuk membaca konteks setup, bukan pengganti analisa utama.` : "Belum ada setup terbaru. AI akan membantu menjelaskan konteks setelah sinyal diterbitkan.";
  return <section className="section aiSection">
    <div className="sectionHeader"><div><span className="eyebrow">AI ASSISTANT</span><h3>Bantuan AI untuk membaca setup</h3></div><button className="textBtn" onClick={()=>setOpen(!open)}>{open?"Tutup":"Buka"}</button></div>
    {open && <div className="aiGrid">
      <div className="aiOrb"><Sparkles size={28}/><b>Context AI</b><span>Analisa • Risiko • Checklist</span></div>
      <div className="aiCopy"><p>{text}</p><div className="aiTags"><span>Risk-aware</span><span>Setup context</span><span>XAUUSD</span></div></div>
    </div>}
  </section>;
}

function PremiumBox({ profile, user, refresh, onOrderCreated }) {
  const premium=isPremiumProfile(profile);
  const daysLeft = premium && profile?.premiumUntil
    ? Math.max(0, Math.ceil((new Date(profile.premiumUntil).getTime()-Date.now())/(24*60*60*1000)))
    : null;
  const expiringSoon = premium && daysLeft!==null && daysLeft<=3;
  const [busy,setBusy]=useState(false);
  const [packages,setPackages]=useState([]);
  const [loadingPkgs,setLoadingPkgs]=useState(true);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const res=await fetch("/api/pricing");
        const data=await res.json();
        if(alive && data.ok) setPackages(data.packages||[]);
      }catch(e){ /* diamkan, tombol default tetap tampil kalau API gagal */ }
      finally{ if(alive) setLoadingPkgs(false); }
    })();
    return()=>{alive=false};
  },[]);

  async function buy(code,label,price) {
    setBusy(true);
    try {
      await createPaymentOrder({user,profile,packageCode:code,packageLabel:label,price});
      alert(premium ? "Order perpanjangan dibuat. Sisa hari aktif kamu bakal otomatis ditambah setelah disetujui admin." : "Order dibuat. Silakan ikuti instruksi pembayaran/admin.");
      onOrderCreated?.();
    }
    catch(e){ alert(e?.message||"Gagal membuat order."); }
    finally { setBusy(false); refresh(); }
  }
  return <section id="premium-renew" className={`premiumBox newCard ${premium?"active":""} ${expiringSoon?"warn":""}`}>
    <div className="premiumIcon"><Crown size={21}/></div>
    <div className="premiumBody">
      <span className="eyebrow">{premium ? (expiringSoon?"PREMIUM MAU HABIS":"PREMIUM ACTIVE") : "PREMIUM ALERT"}</span>
      <h3>{premium ? (expiringSoon?`Tinggal ${daysLeft} hari lagi!`:"Alert Telegram kamu aktif") : "Jangan ketinggalan CALL"}</h3>
      <p>{premium
        ? `Aktif sampai ${fmtDate(profile?.premiumUntil)}. ${expiringSoon?"Perpanjang sekarang biar nggak putus":"Mau nambah durasi? Beli paket lagi"}, sisa hari otomatis ditambahkan.`
        : "Subscriber premium mendapat notifikasi langsung saat admin menerbitkan sinyal."}</p>
    </div>
    {!loadingPkgs && <div className="premiumActions">
      {packages.map(p=> (
        <button key={p.code} disabled={busy} onClick={()=>buy(p.code,p.label,p.priceLabel)}>
          {p.promo && <span className="promoBadge">{p.promo.label}</span>}
          <span>{premium?"Perpanjang":"Beli"} {p.label} • {p.promo?.originalPriceLabel && <s className="promoOldPrice">{p.promo.originalPriceLabel}</s>} {p.priceLabel}</span>
        </button>
      ))}
    </div>}
  </section>;
}

function paymentStatusMeta(status) {
  const s = String(status || "pending").toLowerCase();
  if (s === "paid" || s === "approved" || s === "success") return { label: "Lunas", cls: "paid" };
  if (s === "rejected" || s === "failed" || s === "declined") return { label: "Ditolak", cls: "rejected" };
  if (s === "expired") return { label: "Kedaluwarsa", cls: "expired" };
  return { label: "Menunggu konfirmasi", cls: "pending" };
}

function PaymentHistory({ user, refreshKey }) {
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const list = await getUserPaymentOrders(user.uid);
      setOrders(list);
    }catch(e){
      setError(e?.message||"Gagal memuat riwayat pembayaran.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); },[user?.uid, refreshKey]);

  async function copyOrderId(orderId){
    try{ await navigator.clipboard.writeText(orderId); }catch{}
  }

  return <section className="section">
    <div className="sectionHeader">
      <div><span className="eyebrow">RIWAYAT PEMBAYARAN</span><h3>Order premium kamu</h3></div>
      <button className="iconBtn" disabled={loading} onClick={load}><RefreshCw size={17} className={loading?"spin":""}/></button>
    </div>

    {error && <div className="notice error">{error}</div>}

    {!error && !loading && !orders.length && <div className="emptyBox">Belum ada order pembayaran. Order baru akan muncul di sini setelah kamu klik paket premium di atas.</div>}

    {!error && orders.length > 0 && <div className="paymentList">
      {orders.map((order)=> {
        const meta = paymentStatusMeta(order.status);
        return <article className="paymentItem" key={order.orderId}>
          <div className="paymentMain">
            <b>{order.packageLabel || order.packageCode || "Premium"}</b>
            <span className="paymentOrderId">
              ID: {order.orderId}
              <button type="button" className="copyMini" onClick={()=>copyOrderId(order.orderId)} title="Salin Order ID"><Copy size={12}/></button>
            </span>
          </div>
          <div className="paymentSide">
            <span className={`statusPill ${meta.cls}`}>{meta.label}</span>
            <b>{order.price || "-"}</b>
            <time>{fmtDate(order.createdAt)}</time>
          </div>
        </article>;
      })}
    </div>}

    {!error && orders.some(o => String(o.status||"pending").toLowerCase()==="pending") && <div className="notice">Order berstatus "Menunggu konfirmasi" perlu bukti transfer dikirim ke admin agar segera diverifikasi. Simpan Order ID di atas sebagai referensi.</div>}
  </section>;
}


function TelegramPanel({ user, profile, premium, refresh }) {
  const [code,setCode]=useState(profile?.telegramConnectCode||"");
  const [expiresAt,setExpiresAt]=useState(profile?.telegramConnectExpiresAt||"");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [now,setNow]=useState(Date.now());

  useEffect(()=>{
    if(!expiresAt) return;
    const id=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(id);
  },[expiresAt]);

  useEffect(()=>{ if(!msg)return; const id=setTimeout(()=>setMsg(""),4000); return()=>clearTimeout(id); },[msg]);

  async function generateCode(){
    setBusy(true);setMsg("");
    try{
      const idToken=await user.getIdToken();
      const res=await fetch("/api/telegram-connect-code",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${idToken}`},body:JSON.stringify({})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal membuat kode.");
      setCode(data.code);setExpiresAt(data.expiresAt);
    }catch(e){setMsg(`❌ ${e.message}`)}
    finally{setBusy(false)}
  }

  async function copyCommand(){
    try{await navigator.clipboard.writeText(`/connect ${code}`);setMsg("✅ Command disalin. Paste ke bot Telegram kamu.")}
    catch{setMsg(`Salin manual: /connect ${code}`)}
  }

  async function disconnect(){
    if(!confirm("Putuskan koneksi Telegram dari akun ini?")) return;
    setBusy(true);setMsg("");
    try{
      const idToken=await user.getIdToken();
      const res=await fetch("/api/telegram-disconnect",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${idToken}`},body:JSON.stringify({})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal disconnect.");
      setCode("");setExpiresAt("");setMsg("Telegram berhasil diputus.");
      await refresh();
    }catch(e){setMsg(`❌ ${e.message}`)}
    finally{setBusy(false)}
  }

  async function refreshStatus(){setBusy(true);await refresh();setBusy(false)}

  const secondsLeft=expiresAt?Math.max(0,Math.floor((new Date(expiresAt).getTime()-now)/1000)):0;
  const expired=Boolean(expiresAt)&&secondsLeft<=0;

  if(!premium) return <section className="section newCard adminSection">
    <div className="sectionHeader"><div><span className="eyebrow">TELEGRAM PREMIUM</span><h3>Connect Telegram</h3></div></div>
    <div className="notice">Upgrade ke premium dulu untuk connect akun Telegram dan menerima alert sinyal langsung.</div>
  </section>;

  return <section className="section newCard adminSection">
    <div className="sectionHeader"><div><span className="eyebrow">TELEGRAM PREMIUM</span><h3>Connect Telegram</h3></div><button className="iconBtn" disabled={busy} onClick={refreshStatus}><RefreshCw size={16}/></button></div>

    {profile?.telegramConnected ? <>
      <div className="notice ok"><CheckCircle2 size={15}/> Telegram sudah terhubung{profile.telegramUsername?` (@${profile.telegramUsername})`:""}.</div>
      <div className="adminActions"><button className="dangerBtn" disabled={busy} onClick={disconnect}>Disconnect</button></div>
    </> : <>
      <p className="muted">Generate kode koneksi, lalu kirim ke bot Telegram kamu untuk menghubungkan akun ini.</p>
      {(!code||expired) ? <button className="primaryBtn" disabled={busy} onClick={generateCode}>{busy?"Membuat kode...":"Generate Connect Code"}</button> : <>
        <div className="adminToken"><input readOnly value={`/connect ${code}`}/><button type="button" className="textBtn" onClick={copyCommand}><Copy size={15}/> Copy Command</button></div>
        <div className="notice">Kirim command di atas ke bot Telegram kamu. Kode berlaku {secondsLeft>0?`${Math.floor(secondsLeft/60)}m ${secondsLeft%60}d lagi`:"sudah habis, generate ulang"}.</div>
      </>}
    </>}
    {msg && <div className="notice">{msg}</div>}
  </section>;
}

function AdminPanel({ latest, history, onPublished, token, setToken, onSetResult, busyResultId }) {
  const [direction,setDirection]=useState("BUY");
  const [timeframe,setTimeframe]=useState("M15");
  const [entry,setEntry]=useState("");
  const [sl,setSl]=useState("");
  const [tp,setTp]=useState("");
  const [confidence,setConfidence]=useState("85");
  const [title,setTitle]=useState("");
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState("");
  const [closeNote,setCloseNote]=useState("");

  function saveToken(){localStorage.setItem(ADMIN_TOKEN_KEY,token.trim());setResult("Admin token disimpan.");}
  async function publish(e){
    e.preventDefault();setBusy(true);setResult("");
    try{
      const res=await fetch("/api/admin-signal",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"publish",direction,timeframe,entry,sl,tp,confidence,title,note})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal publish sinyal.");
      setResult(`✅ Signal ${direction} terkirim. ${data.notifications?.successCount||0} premium Telegram menerima alert.`);
      setTitle("");setNote("");
      onPublished();
    }catch(e){setResult(`❌ ${e.message}`)}
    finally{setBusy(false)}
  }
  async function closeSignal(cancelled){
    if(!latest?.id) return;
    if(!confirm(cancelled?"Batalkan entry ini? User premium akan dikasih tau alasannya.":"Tutup sinyal terbaru? User premium akan dikasih tau alasannya.")) return;
    setBusy(true);
    try{
      const res=await fetch("/api/admin-signal",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"close",id:latest.id,note:closeNote,cancelled})});
      const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.error||"Gagal menutup.");
      setResult(cancelled?"🚫 Entry dibatalkan & user premium sudah dikasih tau alasannya.":"⏹ Sinyal ditutup & user premium sudah dikasih tau alasannya.");
      setCloseNote("");
      onPublished();
    }catch(e){setResult(`❌ ${e.message}`)}finally{setBusy(false)}
  }
  const [previewBusy,setPreviewBusy]=useState("");
  async function previewRecap(period){
    if(!token) return;
    setPreviewBusy(period);setResult("");
    try{
      const res=await fetch("/api/wr-recap-cron",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({period,preview:true})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal kirim preview.");
      setResult(`🧪 Preview terkirim (${data.rangeLabel}) — Winrate ${data.stats.winratePercent}% (${data.stats.wins}W/${data.stats.losses}L/${data.stats.be}BE). ${data.notifications?.successCount||0} user menerima.`);
    }catch(e){setResult(`❌ ${e.message}`)}
    finally{setPreviewBusy("")}
  }
  return <section className="adminSection newCard">
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>Publish Signal</h3></div><Shield size={20}/></div>
    <div className="adminToken"><input type="password" placeholder="ADMIN_ACTION_TOKEN" value={token} onChange={e=>setToken(e.target.value)}/><button className="textBtn" onClick={saveToken}>Simpan</button></div>
    <form className="signalForm" onSubmit={publish}>
      <div className="seg"><button type="button" className={direction==="BUY"?"active buy":""} onClick={()=>setDirection("BUY")}><TrendingUp size={16}/> BUY</button><button type="button" className={direction==="SELL"?"active sell":""} onClick={()=>setDirection("SELL")}><TrendingDown size={16}/> SELL</button></div>
      <div className="formGrid">
        <label>Timeframe<select value={timeframe} onChange={e=>setTimeframe(e.target.value)}><option>M1</option><option>M3</option><option>M5</option><option>M15</option><option>M30</option><option>H1</option></select></label>
        <label>Confidence %<input type="number" min="1" max="100" value={confidence} onChange={e=>setConfidence(e.target.value)}/></label>
        <label>Entry<input required value={entry} onChange={e=>setEntry(e.target.value)} placeholder="3345.20"/></label>
        <label>Stop Loss<input required value={sl} onChange={e=>setSl(e.target.value)} placeholder="3338.00"/></label>
        <label>Take Profit<input required value={tp} onChange={e=>setTp(e.target.value)} placeholder="3360.00"/></label>
        <label>Judul<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Gold bullish continuation"/></label>
      </div>
      <label>Catatan analisa<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Contoh: break structure + retest area demand, tunggu confirmation candle." rows="4"/></label>
      <div className="adminActions"><button className="primaryBtn" disabled={busy||!token}><Send size={17}/> {busy?"Mengirim...":"Publish & Notify Premium"}</button></div>
      {result && <div className="notice">{result}</div>}
    </form>

    {latest?.id && (latest.status||"OPEN")==="OPEN" && <div className="closeBox">
      <div className="sectionHeader" style={{marginBottom:8}}><div><span className="eyebrow">TUTUP / BATALKAN CALL AKTIF</span><h4 style={{margin:0}}>{latest.direction} {latest.pair||"XAUUSD"} • {latest.id}</h4></div></div>
      <label>Alasan tutup / cancel <span className="muted">(dikirim ke user premium via Telegram)</span><textarea value={closeNote} onChange={e=>setCloseNote(e.target.value)} rows="2" placeholder="Contoh: Struktur berubah, entry tidak valid lagi. Tunggu setup berikutnya."/></label>
      <div className="adminActions">
        <button type="button" className="dangerBtn" disabled={busy} onClick={()=>closeSignal(false)}>Tutup Signal</button>
        <button type="button" className="ghostBtn" disabled={busy} onClick={()=>closeSignal(true)}>Batalkan Entry (Cancel)</button>
      </div>
    </div>}

    {latest?.id && latest.status!=="CANCELLED" && <div className="resultTagBox">
      <div className="sectionHeader" style={{marginBottom:8}}><div><span className="eyebrow">HASIL CALL TERBARU</span><h4 style={{margin:0}}>{latest.direction} {latest.pair||"XAUUSD"} • {latest.id}</h4></div>{latest.result && <span className={resultBadgeClass(latest.result)}>{resultLabel(latest.result)}</span>}</div>
      <p className="muted" style={{fontSize:13,marginBottom:10}}>Tandai hasil call ini (TP/SL/BE) — otomatis update winrate dan kirim notif Telegram ke premium.</p>
      <div className="adminActions">
        <button type="button" disabled={!token||busyResultId===latest.id} className="okBtn" onClick={()=>onSetResult(latest.id,"WIN")}><CheckCircle2 size={16}/> Tandai TP / WIN</button>
        <button type="button" disabled={!token||busyResultId===latest.id} className="dangerBtn" onClick={()=>onSetResult(latest.id,"LOSS")}><X size={16}/> Tandai SL / LOSS</button>
        <button type="button" disabled={!token||busyResultId===latest.id} className="textBtn" onClick={()=>onSetResult(latest.id,"BE")}><Target size={16}/> Tandai Break Even</button>
      </div>
    </div>}

    <div className="recapPreviewBox">
      <div className="sectionHeader" style={{marginBottom:8}}><div><span className="eyebrow">TEST RECAP</span><h4 style={{margin:0}}>Preview Recap Sekarang</h4></div></div>
      <p className="muted" style={{fontSize:13,marginBottom:10}}>Kirim recap "hari ini s/d sekarang" (bukan window resmi "kemarin") ke Telegram premium, buat ngetes tanpa nunggu jadwal cron. Ditandai jelas [PREVIEW TEST] dan tidak menimpa data recap harian yang asli.</p>
      <div className="adminActions">
        <button type="button" className="textBtn" disabled={!token||previewBusy} onClick={()=>previewRecap("daily")}>{previewBusy==="daily"?"Mengirim...":"Preview Daily"}</button>
        <button type="button" className="textBtn" disabled={!token||previewBusy} onClick={()=>previewRecap("weekly")}>{previewBusy==="weekly"?"Mengirim...":"Preview Weekly"}</button>
        <button type="button" className="textBtn" disabled={!token||previewBusy} onClick={()=>previewRecap("monthly")}>{previewBusy==="monthly"?"Mengirim...":"Preview Monthly"}</button>
      </div>
    </div>
  </section>;
}

function rupiah(n) {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}

function DashboardSummary({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin-dashboard-summary", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal memuat ringkasan.");
      setData(data);
    } catch (e) {
      setError(e?.message || "Gagal memuat ringkasan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  return <section className="adminSection newCard">
    <div className="sectionHeader">
      <div><span className="eyebrow">ADMIN CONTROL</span><h3>Dashboard Ringkasan</h3></div>
      <button className="iconBtn" disabled={loading || !token} onClick={load}><RefreshCw size={16} className={loading ? "spin" : ""}/></button>
    </div>

    {!token && <div className="notice">Isi & simpan ADMIN_ACTION_TOKEN dulu di panel Publish Signal buat lihat ringkasan.</div>}
    {error && <div className="notice error">{error}</div>}

    {data && <>
      <div className="dashGrid">
        <div className="dashCard">
          <small><Users size={13}/> PREMIUM AKTIF</small>
          <strong>{data.users.premiumActive}</strong>
          <span>{data.users.total} total user • {data.users.free} free</span>
        </div>
        <div className="dashCard">
          <small><Clock3 size={13}/> EXPIRE ≤ 7 HARI</small>
          <strong className={data.premium.expiringIn7Days > 0 ? "warnText" : ""}>{data.premium.expiringIn7Days}</strong>
          <span>Segera follow up biar perpanjang</span>
        </div>
        <div className="dashCard">
          <small><Wallet size={13}/> REVENUE BULAN INI</small>
          <strong>{rupiah(data.revenue.thisMonth)}</strong>
          <span>{data.revenue.approvedOrdersThisMonth} order approved</span>
        </div>
        <div className="dashCard">
          <small><TrendingUp size={13}/> REVENUE 30 HARI</small>
          <strong>{rupiah(data.revenue.last30Days)}</strong>
          <span>{data.revenue.approvedOrdersLast30Days} order approved</span>
        </div>
      </div>

      <div className="dashGrid dashGridSecondary">
        <div className="dashCard small">
          <small>USER BARU (7 HARI)</small>
          <strong>{data.users.newLast7Days}</strong>
        </div>
        <div className="dashCard small">
          <small>USER BARU (30 HARI)</small>
          <strong>{data.users.newLast30Days}</strong>
        </div>
        <div className="dashCard small">
          <small>ORDER PENDING</small>
          <strong className={data.orders.pending > 0 ? "warnText" : ""}>{data.orders.pending}</strong>
        </div>
        <div className="dashCard small">
          <small>REVENUE ALL-TIME</small>
          <strong>{rupiah(data.revenue.allTimeApproved)}</strong>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 12 }}>Terakhir diperbarui: {fmtDate(data.generatedAt)}</div>
    </>}
  </section>;
}

function AdminStatusPanel({ token, status, onUpdated }) {
  const [message,setMessage]=useState(status?.message||"");
  const [broadcast,setBroadcast]=useState(true);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState("");

  async function setOnline(online){
    if(!token){ setResult("❌ Isi & simpan ADMIN_ACTION_TOKEN dulu."); return; }
    setBusy(true);setResult("");
    try{
      const res=await fetch("/api/admin-status",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({online,message,broadcastTelegram:broadcast})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal update status.");
      const notif=data.notifications;
      setResult(online
        ? `🟢 Status Online tersimpan.${notif && !notif.skipped ? ` ${notif.successCount||0} premium Telegram dapat notif.` : ""}`
        : "⚪ Status diset Offline.");
      onUpdated();
    }catch(e){setResult(`❌ ${e.message}`)}
    finally{setBusy(false)}
  }

  return <section className="adminSection newCard">
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>Status & Sapaan</h3></div><Bell size={20}/></div>
    <p className="muted" style={{fontSize:13,marginBottom:14}}>Nyalain status "Online" biar user langsung lihat banner + (opsional) dapat notif Telegram, misalnya "Mimin on gess, tunggu sinyal premium ya!"</p>
    <div className="signalForm" style={{gap:12}}>
      <div className="statusNow">
        <span className={status?.online?"onlineDot on":"onlineDot"}/>
        <b>{status?.online?"Sedang Online":"Sedang Offline"}</b>
        {status?.message && <span className="muted"> — "{status.message}"</span>}
      </div>
      <label>Pesan sapaan / custom notif<textarea value={message} onChange={e=>setMessage(e.target.value)} rows="2" placeholder='Contoh: Mimin on gess, tunggu sinyal premium nya ya 🔥'/></label>
      <label className="checkRow"><input type="checkbox" checked={broadcast} onChange={e=>setBroadcast(e.target.checked)}/> Kirim juga ke Telegram premium</label>
      <div className="adminActions">
        <button type="button" className="okBtn" disabled={busy} onClick={()=>setOnline(true)}>🟢 Set Online & Kirim</button>
        <button type="button" className="ghostBtn" disabled={busy} onClick={()=>setOnline(false)}>⚪ Set Offline</button>
      </div>
      {result && <div className="notice">{result}</div>}
    </div>
  </section>;
}

function AdminBroadcastPanel({ token }) {
  const [text,setText]=useState("");
  const [target,setTarget]=useState("premium_connected");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState(null);

  const TARGET_LABELS = {
    premium_connected: "Premium aktif (connected Telegram)",
    all_connected: "Semua user connected Telegram (termasuk yang belum premium)",
    admin_connected: "Admin saja"
  };

  async function send(){
    if(!token){ setResult({error:"❌ Isi & simpan ADMIN_ACTION_TOKEN dulu."}); return; }
    if(text.trim().length<3){ setResult({error:"❌ Isi pesan promo minimal 3 karakter."}); return; }
    if(!window.confirm(`Kirim broadcast promo ke "${TARGET_LABELS[target]}"?\nAksi ini langsung terkirim dan nggak bisa dibatalkan.`)) return;

    setBusy(true); setResult(null);
    try{
      const res=await fetch("/api/admin-broadcast-telegram",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({text,target})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal kirim broadcast.");
      setResult({ok:true,data});
      setText("");
    }catch(e){ setResult({error:`❌ ${e.message}`}); }
    finally{ setBusy(false); }
  }

  return <section className="adminSection newCard">
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>Broadcast Promo</h3></div><Send size={20}/></div>
    <p className="muted" style={{fontSize:13,marginBottom:14}}>Kirim notif promo langsung ke Telegram user yang udah connect bot. Cocok buat kabarin promo paket baru (mis. diskon "60 Hari") biar user tergerak upgrade/perpanjang.</p>
    <div className="signalForm" style={{gap:12}}>
      <label>Target penerima
        <select value={target} onChange={e=>setTarget(e.target.value)}>
          <option value="premium_connected">Premium aktif (connected Telegram)</option>
          <option value="all_connected">Semua user connected Telegram (termasuk belum premium)</option>
          <option value="admin_connected">Admin saja</option>
        </select>
      </label>
      <label>Isi pesan promo<textarea value={text} onChange={e=>setText(e.target.value)} rows="4" placeholder='Contoh: 🔥 Promo spesial! Paket 60 Hari cuma Rp99.000 sampai akhir bulan ini. Sisa hari premium lo otomatis ditambah kalau upgrade sekarang.'/></label>
      <div className="adminActions">
        <button type="button" className="okBtn" disabled={busy} onClick={send}>{busy?"Mengirim...":"📣 Kirim Broadcast"}</button>
      </div>
      {result?.error && <div className="notice" style={{color:"#ff6b6b"}}>{result.error}</div>}
      {result?.ok && <div className="notice">✅ Terkirim ke {result.data.successCount}/{result.data.totalRecipients} penerima{result.data.failedCount>0?` (${result.data.failedCount} gagal)`:""}.</div>}
    </div>
  </section>;
}

const REMIND_COOLDOWN_MS = 30 * 60 * 1000; // samain dengan backend (admin-orders.js)

function AdminOrders({ token }) {
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState("pending");
  const [busyId,setBusyId]=useState("");
  const [now,setNow]=useState(Date.now());

  useEffect(()=>{ const id=setInterval(()=>setNow(Date.now()),30000); return()=>clearInterval(id); },[]);

  async function load(){
    if(!token){ setError("Isi & simpan ADMIN_ACTION_TOKEN dulu di atas."); return; }
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/admin-orders",{headers:{Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal memuat orders.");
      setOrders(data.orders||[]);
    }catch(e){ setError(e?.message||"Gagal memuat orders."); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ load(); },[token]);

  async function act(order,action,extra={}){
    setBusyId(order.orderId+action);
    try{
      const res=await fetch("/api/admin-orders",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({orderId:order.orderId,action,...extra})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Aksi gagal.");
      await load();
    }catch(e){ alert(e?.message||"Aksi gagal."); }
    finally{ setBusyId(""); }
  }

  function approve(order){
    const pkgMatch = String(order.packageCode||order.packageLabel||"").match(/\d+/);
    const defaultDays = pkgMatch ? parseInt(pkgMatch[0],10) : 7;
    const input = window.prompt(`Approve order ${order.orderId}?\nJumlah hari premium (default ${defaultDays}):`, defaultDays);
    if(input===null) return;
    const days = Number(input)||defaultDays;
    act(order,"approve",{days});
  }
  function reject(order){
    if(!window.confirm(`Tolak order ${order.orderId}? User akan menerima notifikasi penolakan.`)) return;
    act(order,"reject");
  }
  function remind(order){ act(order,"remind"); }
  function saveNote(order,value){ act(order,"savenote",{adminNote:value}); }

  const counts = {
    all: orders.length,
    pending: orders.filter(o=>String(o.status||"pending").toLowerCase()==="pending").length,
    approved: orders.filter(o=>String(o.status||"").toLowerCase()==="approved").length,
    rejected: orders.filter(o=>String(o.status||"").toLowerCase()==="rejected").length
  };
  const filtered = orders.filter(o=>{
    if(tab==="all") return true;
    return String(o.status||"pending").toLowerCase()===tab;
  });

  return <section className="adminSection newCard" style={{marginTop:20}}>
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>Payment Orders</h3></div><button className="iconBtn" disabled={loading} onClick={load}><RefreshCw size={16} className={loading?"spin":""}/></button></div>

    <div className="seg orderTabs">
      <button type="button" className={tab==="pending"?"active":""} onClick={()=>setTab("pending")}>Pending ({counts.pending})</button>
      <button type="button" className={tab==="approved"?"active":""} onClick={()=>setTab("approved")}>Approved ({counts.approved})</button>
      <button type="button" className={tab==="rejected"?"active":""} onClick={()=>setTab("rejected")}>Rejected ({counts.rejected})</button>
      <button type="button" className={tab==="all"?"active":""} onClick={()=>setTab("all")}>Semua ({counts.all})</button>
    </div>

    {error && <div className="notice error">{error}</div>}
    {!error && !loading && !filtered.length && <div className="emptyBox">Tidak ada order di kategori ini.</div>}

    <div className="orderList">
      {filtered.map(order=>{
        const meta = paymentStatusMeta(order.status);
        const pending = String(order.status||"pending").toLowerCase()==="pending";
        const remindCooldownLeft = order.remindedAt ? REMIND_COOLDOWN_MS-(now-new Date(order.remindedAt).getTime()) : 0;
        const canRemind = pending && remindCooldownLeft<=0;
        return <AdminOrderRow
          key={order.orderId}
          order={order}
          meta={meta}
          pending={pending}
          canRemind={canRemind}
          remindCooldownLeft={remindCooldownLeft}
          busy={busyId.startsWith(order.orderId)}
          onApprove={()=>approve(order)}
          onReject={()=>reject(order)}
          onRemind={()=>remind(order)}
          onSaveNote={(v)=>saveNote(order,v)}
        />;
      })}
    </div>
  </section>;
}

function AdminOrderRow({ order, meta, pending, canRemind, remindCooldownLeft, busy, onApprove, onReject, onRemind, onSaveNote }){
  const [noteDraft,setNoteDraft]=useState(order.adminNote||"");
  const noteDirty = noteDraft !== (order.adminNote||"");
  const status = String(order.status||"pending").toLowerCase();

  return <article className="orderRow">
    <div className="orderRowTop">
      <div className="orderRowMain">
        <b>{order.email || "-"}</b>
        <span className="paymentOrderId">ID: {order.orderId}</span>
      </div>
      <div className="orderRowSide">
        <span className={`statusPill ${meta.cls}`}>{meta.label}</span>
        <b>{order.packageLabel || order.packageCode || "-"} • {order.price || "-"}</b>
        <time>{fmtDate(order.createdAt)}</time>
      </div>
    </div>

    {status==="approved" && <div className="notice ok">Premium aktif sampai {fmtDate(order.premiumUntil)}.</div>}
    {status==="rejected" && <div className="notice error">Ditolak {fmtDate(order.rejectedAt)}.</div>}
    {order.remindedAt && <div className="notice">Terakhir diingatkan {fmtDate(order.remindedAt)} ({order.reminderCount||1}x).</div>}

    <div className="orderNote">
      <textarea rows="2" placeholder="Catatan internal admin (tidak terlihat user)..." value={noteDraft} onChange={e=>setNoteDraft(e.target.value)}/>
      {noteDirty && <button type="button" className="textBtn" disabled={busy} onClick={()=>onSaveNote(noteDraft)}>Simpan Catatan</button>}
    </div>

    {pending && <div className="adminActions">
      <button className="primaryBtn" disabled={busy} onClick={onApprove}><CheckCircle2 size={15}/> Approve</button>
      <button className="dangerBtn" disabled={busy} onClick={onReject}>Reject</button>
      <button type="button" className="textBtn" disabled={busy||!canRemind} onClick={onRemind}>
        {canRemind ? "Kirim Reminder" : `Reminder lagi dalam ${Math.max(1,Math.ceil(remindCooldownLeft/60000))}m`}
      </button>
    </div>}
  </article>;
}

function AdminUsers({ token }) {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState("all");
  const [search,setSearch]=useState("");
  const [busyUid,setBusyUid]=useState("");
  const [reminderBusy,setReminderBusy]=useState(false);
  const [reminderResult,setReminderResult]=useState(null);

  async function load(){
    if(!token){ setError("Isi & simpan ADMIN_ACTION_TOKEN dulu di atas."); return; }
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/admin-user",{headers:{Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal memuat users.");
      setUsers(data.users||[]);
    }catch(e){ setError(e?.message||"Gagal memuat users."); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); },[token]);

  async function checkReminder(testUid){
    if(!token) return;
    setReminderBusy(true);setReminderResult(null);
    try{
      const res=await fetch("/api/premium-expiry-reminder-cron",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({preview:true,...(testUid?{testUid}:{})})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal cek reminder.");
      setReminderResult(data);
    }catch(e){ setReminderResult({ok:false,error:e?.message||"Gagal cek reminder."}); }
    finally{ setReminderBusy(false); }
  }

  const [busyReminderUid,setBusyReminderUid]=useState("");
  async function testReminderForUser(u){
    if(!token){ alert("Isi & simpan ADMIN_ACTION_TOKEN dulu di atas."); return; }
    setBusyReminderUid(u.uid);
    try{
      const res=await fetch("/api/premium-expiry-reminder-cron",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({preview:true,testUid:u.uid})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal tes reminder.");
      if(data.totalSent===0){
        alert(`Tidak bisa tes ke ${u.email||u.uid}: UID tidak ditemukan di database.`);
      }else{
        const r=data.results[0]||{};
        const emailTxt = r.email_ok===true?"✅ terkirim":r.email_ok===false?"❌ gagal kirim":"– (user tidak punya email)";
        const teleTxt = r.telegram_ok===true?"✅ terkirim":r.telegram_ok===false?"❌ gagal kirim":"– (Telegram belum connect)";
        alert(`Tes reminder ke ${u.email||u.uid}\n\nEmail: ${emailTxt}\nTelegram: ${teleTxt}`);
      }
    }catch(e){ alert(e?.message||"Gagal tes reminder."); }
    finally{ setBusyReminderUid(""); }
  }

  async function act(uid,body){
    setBusyUid(uid);
    try{
      const res=await fetch("/api/admin-user",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({uid,...body})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Aksi gagal.");
      await load();
    }catch(e){ alert(e?.message||"Aksi gagal."); }
    finally{ setBusyUid(""); }
  }

  function grantPremium(u){
    const input=window.prompt(`Kasih premium ke ${u.email||u.uid}?\nJumlah hari (nambah dari sisa premium yang ada, kalau masih aktif):`,"30");
    if(input===null) return;
    const days=Number(input);
    if(!Number.isFinite(days)||days<=0){ alert("Jumlah hari harus angka positif."); return; }
    act(u.uid,{role:"premium",premiumDays:days});
  }
  function revokePremium(u){
    if(!window.confirm(`Cabut premium dari ${u.email||u.uid}? User langsung jadi free.`)) return;
    act(u.uid,{action:"revokePremium"});
  }
  function makeAdmin(u){
    if(!window.confirm(`Jadikan ${u.email||u.uid} admin? User ini bakal punya akses penuh.`)) return;
    act(u.uid,{role:"admin"});
  }
  function removeAdmin(u){
    if(!window.confirm(`Cabut akses admin dari ${u.email||u.uid}? User jadi free.`)) return;
    act(u.uid,{role:"free"});
  }

  const counts = {
    all: users.length,
    premium: users.filter(u=>isPremiumProfile(u)).length,
    free: users.filter(u=>u.role!=="admin"&&!isPremiumProfile(u)).length,
    admin: users.filter(u=>u.role==="admin").length
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter(u=>{
    const matchTab = tab==="all" ? true
      : tab==="premium" ? isPremiumProfile(u)
      : tab==="admin" ? u.role==="admin"
      : u.role!=="admin" && !isPremiumProfile(u);
    if(!matchTab) return false;
    if(!q) return true;
    return String(u.email||"").toLowerCase().includes(q)
      || String(u.uid||"").toLowerCase().includes(q)
      || String(u.telegramUsername||"").toLowerCase().includes(q);
  });

  return <section className="adminSection newCard" style={{marginTop:20}}>
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>User Management</h3></div><button className="iconBtn" disabled={loading} onClick={load}><RefreshCw size={16} className={loading?"spin":""}/></button></div>

    <input className="userSearch" placeholder="Cari email, UID, atau username Telegram..." value={search} onChange={e=>setSearch(e.target.value)}/>

    <div className="seg orderTabs">
      <button type="button" className={tab==="all"?"active":""} onClick={()=>setTab("all")}>Semua ({counts.all})</button>
      <button type="button" className={tab==="premium"?"active":""} onClick={()=>setTab("premium")}>Premium ({counts.premium})</button>
      <button type="button" className={tab==="free"?"active":""} onClick={()=>setTab("free")}>Free ({counts.free})</button>
      <button type="button" className={tab==="admin"?"active":""} onClick={()=>setTab("admin")}>Admin ({counts.admin})</button>
    </div>

    {error && <div className="notice error">{error}</div>}
    {!error && !loading && !filtered.length && <div className="emptyBox">Tidak ada user di kategori ini.</div>}

    <div className="userList scrollable">
      {filtered.map(u=><AdminUserRow
        key={u.uid}
        u={u}
        busy={busyUid===u.uid}
        onGrant={()=>grantPremium(u)}
        onRevoke={()=>revokePremium(u)}
        onMakeAdmin={()=>makeAdmin(u)}
        onRemoveAdmin={()=>removeAdmin(u)}
        onTestReminder={()=>testReminderForUser(u)}
        reminderBusy={busyReminderUid===u.uid}
      />)}
    </div>

    <div className="recapPreviewBox" style={{marginTop:16}}>
      <div className="sectionHeader" style={{marginBottom:8}}><div><span className="eyebrow">H-1 REMINDER</span><h4 style={{margin:0}}>Reminder Premium Mau Habis</h4></div></div>
      <p className="muted" style={{fontSize:13,marginBottom:10}}>Otomatis kirim email + Telegram ke user yang premiumnya tinggal 1 hari (cron harian). Cek dulu siapa yang bakal kena reminder hari ini, atau klik "Tes Reminder H-1" di baris user manapun di bawah buat tes kirim sungguhan (gak perlu copy UID manual lagi).</p>
      <div className="adminActions">
        <button type="button" className="textBtn" disabled={!token||reminderBusy} onClick={()=>checkReminder()}>{reminderBusy?"Mengecek...":"Cek Siapa Kena Reminder (Dry Run)"}</button>
      </div>
      {reminderResult && !reminderResult.ok && <div className="notice error" style={{marginTop:10}}>{reminderResult.error}</div>}
      {reminderResult && reminderResult.ok && reminderResult.mode==="dry-run" && (
        <div className="notice" style={{marginTop:10}}>
          {reminderResult.totalCandidates===0 ? "Tidak ada user yang premiumnya tinggal 1 hari saat ini." : `${reminderResult.totalCandidates} user akan menerima reminder:`}
          {reminderResult.totalCandidates>0 && <ul style={{margin:"8px 0 0",paddingLeft:18}}>
            {reminderResult.candidates.map(c=><li key={c.uid} style={{fontSize:12.5}}>{c.email||c.uid} — sisa {c.daysLeft} hari {c.telegramConnected?"(Telegram ✅)":"(Telegram ❌)"}</li>)}
          </ul>}
        </div>
      )}
      {reminderResult && reminderResult.ok && reminderResult.mode==="test-single-user" && (
        <div className="notice" style={{marginTop:10}}>
          {reminderResult.totalSent===0 ? "UID tidak ditemukan atau tidak memenuhi kriteria." : `Tes terkirim ke ${reminderResult.results[0]?.email||"user"}: email ${reminderResult.results[0]?.email_ok===true?"✅":reminderResult.results[0]?.email_ok===false?"❌":"–"}, Telegram ${reminderResult.results[0]?.telegram_ok===true?"✅":reminderResult.results[0]?.telegram_ok===false?"❌":"–"}.`}
        </div>
      )}
    </div>
  </section>;
}

function AdminUserRow({ u, busy, onGrant, onRevoke, onMakeAdmin, onRemoveAdmin, onTestReminder, reminderBusy }){
  const premium = isPremiumProfile(u);
  const isAdmin = u.role==="admin";
  const untilMs = u.premiumUntil ? new Date(u.premiumUntil).getTime() : 0;
  const daysLeft = untilMs ? Math.ceil((untilMs-Date.now())/(1000*60*60*24)) : null;
  const expiringSoon = premium && daysLeft!==null && daysLeft<=3;

  async function copyUid(){
    try{ await navigator.clipboard.writeText(u.uid); }catch{}
  }

  return <article className="orderRow">
    <div className="orderRowTop">
      <div className="orderRowMain">
        <b>{u.email || "(tanpa email)"}</b>
        <span className="paymentOrderId">
          UID: {u.uid}
          <button type="button" className="copyMini" onClick={copyUid} title="Salin UID"><Copy size={12}/></button>
        </span>
      </div>
      <div className="orderRowSide">
        <span className={`statusPill ${isAdmin?"paid":premium?"paid":"expired"}`}>{isAdmin?"Admin":premium?"Premium":"Free"}</span>
        {premium && !isAdmin && <b className={expiringSoon?"warnText":""}>{expiringSoon?`⚠️ ${daysLeft}h lagi`:`s/d ${fmtDate(u.premiumUntil)}`}</b>}
        <time>Daftar {fmtDate(u.createdAt)}</time>
      </div>
    </div>

    <div className="userMeta">
      <span className={`telegramTag ${u.telegramConnected?"connected":""}`}>
        {u.telegramConnected ? `✅ @${u.telegramUsername||"terhubung"}` : "❌ Telegram belum connect"}
      </span>
    </div>

    <div className="adminActions">
      {!isAdmin && <button type="button" className="okBtn" disabled={busy} onClick={onGrant}><CheckCircle2 size={15}/> {premium?"Tambah Hari":"Kasih Premium"}</button>}
      {premium && !isAdmin && <button type="button" className="dangerBtn" disabled={busy} onClick={onRevoke}>Cabut Premium</button>}
      {!isAdmin && <button type="button" className="textBtn" disabled={busy} onClick={onMakeAdmin}>Jadikan Admin</button>}
      {isAdmin && <button type="button" className="textBtn" disabled={busy} onClick={onRemoveAdmin}>Cabut Admin</button>}
      {premium && !isAdmin && <button type="button" className="textBtn" disabled={reminderBusy} onClick={onTestReminder}>{reminderBusy?"Mengirim...":"Tes Reminder H-1"}</button>}
    </div>
  </article>;
}

function emptyPricingForm(){
  return { code:"", label:"", durationDays:"", priceLabel:"", active:true, sortOrder:99, promoActive:false, promoLabel:"", promoOriginalPriceLabel:"", promoUntil:"" };
}

function AdminPricing({ token }){
  const [packages,setPackages]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [form,setForm]=useState(emptyPricingForm());
  const [editingCode,setEditingCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");

  async function load(){
    if(!token){ setError("Isi & simpan ADMIN_ACTION_TOKEN dulu di panel Publish Signal."); return; }
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/pricing",{headers:{Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal memuat daftar harga.");
      setPackages(data.packages||[]);
    }catch(e){ setError(e?.message||"Gagal memuat daftar harga."); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); },[token]);

  function startEdit(p){
    setEditingCode(p.code);
    setForm({
      code:p.code, label:p.label, durationDays:String(p.durationDays||""), priceLabel:p.priceLabel,
      active:p.active!==false, sortOrder:p.sortOrder??99,
      promoActive:!!p.promo?.active, promoLabel:p.promo?.label||"", promoOriginalPriceLabel:p.promo?.originalPriceLabel||"",
      promoUntil:p.promo?.until ? p.promo.until.slice(0,16) : ""
    });
  }
  function startNew(){ setEditingCode("__new__"); setForm(emptyPricingForm()); }
  function cancelEdit(){ setEditingCode(""); setForm(emptyPricingForm()); setMsg(""); }

  async function submit(e){
    e.preventDefault();
    if(!token) return;
    setBusy(true);setMsg("");
    try{
      const body={
        action:"save",
        code:form.code, label:form.label, priceLabel:form.priceLabel,
        durationDays:Number(form.durationDays)||0, active:form.active, sortOrder:Number(form.sortOrder)||99,
        promo: form.promoActive ? { active:true, label:form.promoLabel, originalPriceLabel:form.promoOriginalPriceLabel, until: form.promoUntil||null } : null
      };
      const res=await fetch("/api/pricing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal menyimpan paket.");
      setMsg(`✅ Paket ${data.package.code} tersimpan.`);
      cancelEdit();
      await load();
    }catch(e){ setMsg(`❌ ${e.message}`); }
    finally{ setBusy(false); }
  }

  async function remove(p){
    if(!token) return;
    if(!window.confirm(`Hapus paket ${p.label} (${p.code})? User tidak akan bisa beli paket ini lagi.`)) return;
    setBusy(true);
    try{
      const res=await fetch("/api/pricing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"delete",code:p.code})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal menghapus paket.");
      await load();
    }catch(e){ alert(e?.message||"Gagal menghapus paket."); }
    finally{ setBusy(false); }
  }

  const isEditing = editingCode!=="";

  return <section className="adminSection newCard">
    <div className="sectionHeader"><div><span className="eyebrow">ADMIN CONTROL</span><h3>Harga & Promo</h3></div><button className="iconBtn" disabled={loading} onClick={load}><RefreshCw size={16} className={loading?"spin":""}/></button></div>
    <p className="muted" style={{fontSize:13,marginBottom:4}}>Ubah harga paket premium yang tampil di halaman user, atau bikin promo (badge + harga coret) tanpa perlu deploy ulang.</p>

    {error && <div className="notice error">{error}</div>}

    <div className="pricingList" style={{marginTop:12}}>
      {packages.map(p=> (
        <div key={p.code} className={`pricingRow${p.active===false?" inactive":""}`}>
          <div className="pricingRowMain">
            <span className="pricingCode">{p.code}</span>
            <b>{p.label}</b>
            <span className="muted">{p.durationDays} hari</span>
            {p.promo?.originalPriceLabel && <s className="promoOldPrice">{p.promo.originalPriceLabel}</s>}
            <b>{p.priceLabel}</b>
            {p.promo && <span className="statusPill paid">{p.promo.label}</span>}
            {p.active===false && <span className="statusPill expired">Nonaktif</span>}
          </div>
          <div className="pricingRowActions">
            <button type="button" className="textBtn" disabled={busy} onClick={()=>startEdit(p)}>Edit</button>
            <button type="button" className="dangerBtn" disabled={busy} onClick={()=>remove(p)}>Hapus</button>
          </div>
        </div>
      ))}
      {!loading && !packages.length && !error && <div className="emptyBox">Belum ada paket. Tambah paket pertama di bawah.</div>}
    </div>

    {!isEditing && <div className="adminActions" style={{marginTop:14}}>
      <button type="button" className="primaryBtn" onClick={startNew}><Sparkles size={15}/> Tambah Paket / Promo Baru</button>
    </div>}

    {isEditing && <form className="pricingForm" onSubmit={submit}>
      <div className="sectionHeader" style={{marginBottom:0}}><div><h4 style={{margin:0}}>{editingCode==="__new__"?"Paket Baru":`Edit Paket ${editingCode}`}</h4></div></div>
      <div className="pricingFormGrid">
        <label>Kode Paket <span className="muted">(unik, contoh: 7D)</span>
          <input type="text" required disabled={editingCode!=="__new__"} value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="7D"/>
        </label>
        <label>Label <span className="muted">(tampil ke user)</span>
          <input type="text" required value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="7 Hari"/>
        </label>
        <label>Durasi (hari)
          <input type="number" required min="1" value={form.durationDays} onChange={e=>setForm(f=>({...f,durationDays:e.target.value}))} placeholder="7"/>
        </label>
        <label>Harga <span className="muted">(teks, contoh: Rp10K)</span>
          <input type="text" required value={form.priceLabel} onChange={e=>setForm(f=>({...f,priceLabel:e.target.value}))} placeholder="Rp10K"/>
        </label>
        <label>Urutan Tampil
          <input type="number" value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:e.target.value}))}/>
        </label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/> Aktif (tampil ke user)</label>
      </div>

      <label className="checkRow"><input type="checkbox" checked={form.promoActive} onChange={e=>setForm(f=>({...f,promoActive:e.target.checked}))}/> Jadikan promo (badge + harga coret)</label>

      {form.promoActive && <div className="pricingPromoBox">
        <div className="pricingFormGrid">
          <label>Label Promo <span className="muted">(badge kecil)</span>
            <input type="text" value={form.promoLabel} onChange={e=>setForm(f=>({...f,promoLabel:e.target.value}))} placeholder="PROMO 17AN"/>
          </label>
          <label>Harga Asli <span className="muted">(dicoret, opsional)</span>
            <input type="text" value={form.promoOriginalPriceLabel} onChange={e=>setForm(f=>({...f,promoOriginalPriceLabel:e.target.value}))} placeholder="Rp15K"/>
          </label>
          <label>Promo Berlaku Sampai <span className="muted">(opsional, auto nonaktif setelah lewat)</span>
            <input type="datetime-local" value={form.promoUntil} onChange={e=>setForm(f=>({...f,promoUntil:e.target.value}))}/>
          </label>
        </div>
      </div>}

      <div className="adminActions">
        <button type="submit" className="okBtn" disabled={busy}><CheckCircle2 size={15}/> {busy?"Menyimpan...":"Simpan Paket"}</button>
        <button type="button" className="textBtn" disabled={busy} onClick={cancelEdit}>Batal</button>
      </div>
    </form>}

    {msg && <div className="notice" style={{marginTop:10}}>{msg}</div>}
  </section>;
}

const ADMIN_GROUPS = [
  { id: "overview", label: "Ringkasan", panels: [
    { id: "dashboard", label: "Dashboard", desc: "Revenue, user premium aktif, order pending", icon: LayoutDashboard }
  ]},
  { id: "ops", label: "Operasional Signal", panels: [
    { id: "publish", label: "Publish Signal", desc: "Terbitkan call baru, tutup/batalkan, test recap WR", icon: Megaphone },
    { id: "status", label: "Status & Sapaan", desc: "Banner online/offline + broadcast Telegram", icon: Radio },
    { id: "broadcast", label: "Broadcast Promo", desc: "Kirim notif promo ke Telegram user", icon: Send }
  ]},
  { id: "people", label: "Pengguna & Order", panels: [
    { id: "orders", label: "Payment Orders", desc: "Approve / reject order premium user", icon: Wallet },
    { id: "users", label: "User Management", desc: "Kelola role, kasih premium, tes reminder H-1", icon: Users },
    { id: "pricing", label: "Harga & Promo", desc: "Ubah harga paket premium & bikin promo baru", icon: Crown }
  ]},
  { id: "stats", label: "Statistik", panels: [
    { id: "winrate", label: "Winrate Signal", desc: "Statistik performa signal (7/30 hari)", icon: Target }
  ]}
];
const ADMIN_PANELS = ADMIN_GROUPS.flatMap(g => g.panels);

function AdminShell({ panelId, onSelect, ...rest }) {
  const activeId = ADMIN_PANELS.some(p => p.id === panelId) ? panelId : "dashboard";
  const active = ADMIN_PANELS.find(p => p.id === activeId);
  const activeGroup = ADMIN_GROUPS.find(g => g.panels.some(p => p.id === activeId));

  return <section className="adminShell">
    <aside className="adminSidebar">
      <div className="adminSidebarHead"><Shield size={16}/><span>ADMIN CONTROL ROOM</span></div>
      <nav>
        {ADMIN_GROUPS.map(g => (
          <div className="adminNavGroup" key={g.id}>
            <span className="adminNavGroupLabel">{g.label}</span>
            {g.panels.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`adminNavItem${p.id === activeId ? " active" : ""}`}
                  onClick={() => onSelect(p.id)}
                >
                  <Icon size={16}/>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>

    <div className="adminContent">
      <div className="adminContentHead">
        <div><span className="eyebrow">{activeGroup?.label?.toUpperCase()}</span><h3>{active?.label}</h3><p>{active?.desc}</p></div>
      </div>

      {activeId === "dashboard" && <DashboardSummary token={rest.token}/>}
      {activeId === "winrate" && <WinrateCard stats={rest.stats}/>}
      {activeId === "status" && <AdminStatusPanel token={rest.token} status={rest.adminStatus} onUpdated={rest.loadAdminStatus}/>}
      {activeId === "broadcast" && <AdminBroadcastPanel token={rest.token}/>}
      {activeId === "publish" && <AdminPanel latest={rest.latest} history={rest.history} onPublished={rest.onPublished} token={rest.token} setToken={rest.setToken} onSetResult={rest.onSetResult} busyResultId={rest.busyResultId}/>}
      {activeId === "orders" && <AdminOrders token={rest.token}/>}
      {activeId === "users" && <AdminUsers token={rest.token}/>}
      {activeId === "pricing" && <AdminPricing token={rest.token}/>}
    </div>
  </section>;
}

function AppShell({ user, profile, refreshProfile, profileError }) {
  const [latest,setLatest]=useState(null);
  const [history,setHistory]=useState([]);
  const [stats,setStats]=useState(null);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState("");
  const [paymentRefreshKey,setPaymentRefreshKey]=useState(0);
  const [adminToken,setAdminToken]=useState(()=>localStorage.getItem(ADMIN_TOKEN_KEY)||"");
  const [busyResultId,setBusyResultId]=useState("");
  const [tab,setTab]=useState(()=> new URLSearchParams(window.location.search).get("adminPanel") ? "admin" : "signal");
  const [adminPanel,setAdminPanel]=useState(()=> new URLSearchParams(window.location.search).get("adminPanel") || "dashboard");
  function selectAdminPanel(id){
    setAdminPanel(id);
    const url=new URL(window.location.href);
    url.searchParams.set("adminPanel",id);
    window.history.replaceState({},"",url.toString());
  }
  const premium=isPremiumProfile(profile);
  const admin=profile?.role==="admin";

  const TABS=[
    {id:"signal",label:"Sinyal",icon:Activity},
    {id:"premium",label:"Premium",icon:Crown},
    {id:"telegram",label:"Telegram",icon:Zap},
    ...(admin?[{id:"admin",label:"Admin",icon:Shield}]:[])
  ];

  async function loadSignals(silent=false){
    if(!silent)setLoading(true);
    try{
      const res=await fetch("/api/admin-signal");
      const data=await res.json();
      if(data.ok){setLatest(data.latest||null);setHistory(data.history||[]);setStats(data.stats||null);}
    }catch(e){ if(!silent) setToast("Signal feed gagal dimuat.");}
    finally{if(!silent)setLoading(false)}
  }

  async function setSignalResult(id,result){
    if(!adminToken){ setToast("Isi & simpan ADMIN_ACTION_TOKEN dulu di panel admin."); return; }
    setBusyResultId(id);
    try{
      const res=await fetch("/api/admin-signal",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${adminToken}`},body:JSON.stringify({action:"result",id,result})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||"Gagal menandai hasil.");
      setToast(`Hasil ${result} tersimpan & notif Telegram terkirim ke ${data.notifications?.successCount||0} premium.`);
      await loadSignals();
    }catch(e){ setToast(`❌ ${e.message}`); }
    finally{ setBusyResultId(""); }
  }

  const [adminStatus,setAdminStatus]=useState(null);
  async function loadAdminStatus(){
    try{
      const res=await fetch("/api/admin-status");
      const data=await res.json();
      if(data.ok) setAdminStatus(data);
    }catch(e){/* diamkan, banner cuma bonus, bukan fitur kritis */}
  }

  useEffect(()=>{loadSignals(); const id=setInterval(()=>loadSignals(true),15000); return()=>clearInterval(id)},[]);
  useEffect(()=>{loadAdminStatus(); const id=setInterval(loadAdminStatus,20000); return()=>clearInterval(id)},[]);
  useEffect(()=>{ if(!toast)return; const id=setTimeout(()=>setToast(""),3500);return()=>clearTimeout(id)},[toast]);

  useEffect(()=>{
    if(!("Notification" in window))return;
    const seen=sessionStorage.getItem("xau_seen_signal");
    if(latest?.id && seen && seen!==latest.id){
      setToast(`🔔 Signal baru: ${latest.direction} ${latest.pair||"XAUUSD"}`);
      if(Notification.permission==="granted") new Notification("XAU AI Signal", {body:`${latest.direction} • Entry ${latest.entry} • SL ${latest.sl} • TP ${latest.tp}`});
    }
    if(latest?.id)sessionStorage.setItem("xau_seen_signal",latest.id);
  },[latest?.id]);

  async function enableNotif(){
    if(!("Notification" in window)) return setToast("Browser ini tidak mendukung notifikasi.");
    const p=await Notification.requestPermission();
    setToast(p==="granted"?"Notifikasi browser aktif.":"Izin notifikasi belum diberikan.");
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brandLogo">X</div><div><b>XAU AI SIGNAL</b><span>Manual signal desk</span></div></div>
      <nav><button className="navBtn" onClick={enableNotif}><Bell size={16}/> Alerts</button><button className="navBtn ghost" onClick={logout}><LogOut size={16}/></button></nav>
    </header>

    <main className="container">
      <section className="welcome">
        <div><span className="eyebrow">XAUUSD • MANUAL CALL CENTER</span><h1>Informasi sinyal, <span>tanpa ribet.</span></h1><p>Admin menganalisa market secara manual. Setelah call diterbitkan, signal tampil di sini dan subscriber premium langsung menerima alert Telegram.</p><div className="welcomeStats"><span><Activity size={15}/> Live feed</span><span><Bot size={15}/> AI assistant</span><span><Crown size={15}/> Premium alert</span></div></div>
        <div className="miniPanel"><div className="miniTop"><span>ACCOUNT</span><span className={premium?"status premium":"status"}>{premium?"PREMIUM":"FREE"}</span></div><b>{user.email||"User"}</b><small>{profile?.telegramConnected?"Telegram connected":"Telegram not connected"}</small></div>
      </section>

      {adminStatus?.online && <div className="adminOnlineBanner"><span className="onlineDot on"/><b>Mimin Online</b>{adminStatus.message && <span> — {adminStatus.message}</span>}</div>}

      {toast && <div className="toast"><Bell size={17}/>{toast}<button onClick={()=>setToast("")}><X size={15}/></button></div>}
      {profileError && <div className="notice error profileNotice">Akses akun belum terbaca. Silakan refresh halaman.</div>}

      <div className="mainTabs">
        {TABS.map(t=>{const Icon=t.icon;return <button key={t.id} type="button" className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><Icon size={16}/> {t.label}</button>})}
      </div>

      {tab==="signal" && <>
        {loading ? <div className="loadingCard newCard"><RefreshCw className="spin"/><span>Memuat signal feed...</span></div> : <SignalCard signal={latest} premium={premium}/>}
        <Feed history={history} onRefresh={()=>loadSignals()} admin={admin} onSetResult={setSignalResult} busyResultId={busyResultId}/>
        <AiPanel signal={latest}/>
      </>}

      {tab==="premium" && <>
        <PremiumBox profile={profile} user={user} refresh={refreshProfile} onOrderCreated={()=>setPaymentRefreshKey(k=>k+1)}/>
        <PaymentHistory user={user} refreshKey={paymentRefreshKey}/>
      </>}

      {tab==="telegram" && <TelegramPanel user={user} profile={profile} premium={premium} refresh={refreshProfile}/>}

      {tab==="admin" && admin && (
        <AdminShell
          panelId={adminPanel}
          onSelect={selectAdminPanel}
          token={adminToken}
          setToken={setAdminToken}
          stats={stats}
          adminStatus={adminStatus}
          loadAdminStatus={loadAdminStatus}
          latest={latest}
          history={history}
          onPublished={()=>loadSignals()}
          onSetResult={setSignalResult}
          busyResultId={busyResultId}
        />
      )}

      <footer><span>{APP_NAME}</span> • Signal information & AI assistance • Trading dengan risk management.</footer>
    </main>
  </div>;
}

export default function App(){
  const [user,setUser]=useState(undefined);
  const [showAuth,setShowAuth]=useState(false);
  const [profile,setProfile]=useState(null);
  const [profileLoading,setProfileLoading]=useState(false);
  const [profileError,setProfileError]=useState("");

  useEffect(()=>listenAuth(async u=>{
    setUser(u||null);
    if(!u){
      setProfile(null);
      setProfileError("");
      return;
    }
    setProfileLoading(true);
    setProfileError("");
    try{
      const loaded=await getUserProfile(u.uid);
      setProfile(loaded);
      if(!loaded) setProfileError("Profile user belum terbaca.");
    }catch(error){
      setProfile(null);
      setProfileError(error?.message||"Profile user belum terbaca.");
    }finally{setProfileLoading(false);}
  }),[]);

  async function refreshProfile(){
    if(!user)return;
    try{
      setProfileLoading(true);
      setProfileError("");
      setProfile(await getUserProfile(user.uid));
    }catch(error){
      setProfileError(error?.message||"Profile user belum terbaca.");
    }finally{setProfileLoading(false);}
  }

  if(window.location.pathname==="/auth-action") return <AuthActionPage/>;
  if(user===undefined) return <main className="loadingScreen"><RefreshCw className="spin"/><span>Menyiapkan Signal Desk...</span></main>;
  if(!user) return showAuth ? <AuthScreen onDone={()=>{}} onBack={()=>setShowAuth(false)}/> : <Landing onGetStarted={()=>setShowAuth(true)}/>;

  // Wajibkan verifikasi email untuk akun email/password.
  // Akun Google sudah terverifikasi otomatis oleh Firebase, jadi dilewati.
  const isGoogleAccount = user.providerData?.some(p => p.providerId === "google.com");
  if (!user.emailVerified && !isGoogleAccount) {
    return <EmailVerifyScreen user={user} onVerified={()=>setUser({...auth.currentUser})}/>;
  }

  if(profileLoading && !profile) return <main className="loadingScreen"><RefreshCw className="spin"/><span>Membaca akses akun...</span></main>;

  // Never silently downgrade an existing account to FREE when the legacy
  // profile cannot be read. That could hide admin/premium/Telegram access.
  if(!profile) return <main className="loadingScreen accessErrorScreen">
    <Shield size={34}/>
    <strong>Akses akun belum terbaca</strong>
    <span>{profileError || "Data role dan Telegram belum berhasil dimuat."}</span>
    <div className="accessErrorActions">
      <button className="primaryBtn" onClick={()=>window.location.reload()}>Coba lagi</button>
      <button className="textBtn" onClick={logout}>Keluar</button>
    </div>
  </main>;

  return <AppShell user={user} profile={profile} refreshProfile={refreshProfile} profileError={profileError}/>;
}

function AuthActionPage(){
  const [params] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return { mode:q.get("mode")||"", oobCode:q.get("oobCode")||"" };
  });
  const [email,setEmail]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPasswordValue]=useState("");
  const [status,setStatus]=useState("loading");
  const [message,setMessage]=useState("Memvalidasi link keamanan...");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    async function run(){
      if(!auth || !params.mode || !params.oobCode){setStatus("error");setMessage("Link tidak lengkap atau konfigurasi Firebase belum siap.");return}
      try{
        if(params.mode==="resetPassword"){
          const e=await verifyPasswordResetCode(auth,params.oobCode);
          if(!active)return; setEmail(e);setStatus("ready");setMessage("Link valid. Buat password baru untuk akun kamu.");return;
        }
        if(params.mode==="verifyEmail"||params.mode==="recoverEmail"){
          await applyActionCode(auth,params.oobCode);
          if(!active)return;setStatus("success");setMessage(params.mode==="verifyEmail"?"Email berhasil diverifikasi.":"Perubahan email berhasil dipulihkan.");return;
        }
        setStatus("error");setMessage("Tipe aksi Firebase belum didukung.");
      }catch(e){if(!active)return;setStatus("error");setMessage("Link tidak valid, sudah kedaluwarsa, atau sudah pernah digunakan.");}
    }
    run();return()=>{active=false};
  },[params.mode,params.oobCode]);

  async function submit(e){
    e.preventDefault();
    if(newPassword.length<6){setMessage("Password minimal 6 karakter.");return}
    if(newPassword!==confirmPassword){setMessage("Konfirmasi password belum sama.");return}
    setBusy(true);
    try{await confirmPasswordReset(auth,params.oobCode,newPassword);setStatus("success");setMessage("Password berhasil diganti. Silakan login.");setNewPassword("");setConfirmPasswordValue("");}
    catch(e){setStatus("error");setMessage("Gagal mengganti password. Minta link reset baru.");}
    finally{setBusy(false)}
  }

  return <main className="authShell"><section className="authCard newCard">
    <div className="brandMark">X</div><div className="eyebrow">SECURE ACCOUNT</div>
    <h1>{params.mode==="resetPassword"?"Reset Password":"Account Verification"}</h1>
    <p className="muted">{message}</p>
    {params.mode==="resetPassword"&&status==="ready"&&<form className="authForm" onSubmit={submit}>
      <label>Email<input value={email} disabled/></label>
      <label>Password baru<input type="password" minLength={6} value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label>
      <label>Ulangi password<input type="password" minLength={6} value={confirmPassword} onChange={e=>setConfirmPasswordValue(e.target.value)} autoComplete="new-password"/></label>
      <button className="primaryBtn" disabled={busy}>{busy?"Menyimpan...":"Simpan Password Baru"}</button>
    </form>}
    {(status==="success"||status==="error")&&<a className="primaryBtn linkAsBtn" href={APP_URL}>{status==="success"?"Kembali ke Login":"Minta Link Baru"}</a>}
    <small className="authFoot">Domain resmi: www.xauaisignal.online</small>
  </section></main>;
}
