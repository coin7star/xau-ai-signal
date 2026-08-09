import { useEffect, useMemo, useState } from "react";
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from "firebase/auth";
import {
  Activity, Bell, Bot, ArrowLeft, CheckCircle2, Clock3, Copy, Crown, LogIn,
  LogOut, Menu, RefreshCw, Send, Shield, Sparkles, Target, TrendingDown,
  TrendingUp, User, X, Zap
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
  const [busy,setBusy]=useState(false);
  async function buy(code,label,price) {
    setBusy(true);
    try {
      await createPaymentOrder({user,profile,packageCode:code,packageLabel:label,price});
      alert("Order dibuat. Silakan ikuti instruksi pembayaran/admin.");
      onOrderCreated?.();
    }
    catch(e){ alert(e?.message||"Gagal membuat order."); }
    finally { setBusy(false); refresh(); }
  }
  return <section className={`premiumBox newCard ${premium?"active":""}`}>
    <div className="premiumIcon"><Crown size={21}/></div>
    <div className="premiumBody">
      <span className="eyebrow">{premium?"PREMIUM ACTIVE":"PREMIUM ALERT"}</span>
      <h3>{premium ? "Alert Telegram kamu aktif" : "Jangan ketinggalan CALL"}</h3>
      <p>{premium ? `Aktif sampai ${fmtDate(profile?.premiumUntil)}.` : "Subscriber premium mendapat notifikasi langsung saat admin menerbitkan sinyal."}</p>
    </div>
    {!premium && <div className="premiumActions"><button disabled={busy} onClick={()=>buy("7D","7 Day","Rp10K")}>7 Hari • Rp10K</button><button disabled={busy} onClick={()=>buy("30D","30 Day","Rp30K")}>30 Hari • Rp30K</button></div>}
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
    const defaultDays = String(order.packageCode||order.packageLabel||"").includes("30") ? 30 : 7;
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

    <div className="userList">
      {filtered.map(u=><AdminUserRow
        key={u.uid}
        u={u}
        busy={busyUid===u.uid}
        onGrant={()=>grantPremium(u)}
        onRevoke={()=>revokePremium(u)}
        onMakeAdmin={()=>makeAdmin(u)}
        onRemoveAdmin={()=>removeAdmin(u)}
      />)}
    </div>
  </section>;
}

function AdminUserRow({ u, busy, onGrant, onRevoke, onMakeAdmin, onRemoveAdmin }){
  const premium = isPremiumProfile(u);
  const isAdmin = u.role==="admin";
  const untilMs = u.premiumUntil ? new Date(u.premiumUntil).getTime() : 0;
  const daysLeft = untilMs ? Math.ceil((untilMs-Date.now())/(1000*60*60*24)) : null;
  const expiringSoon = premium && daysLeft!==null && daysLeft<=3;

  return <article className="orderRow">
    <div className="orderRowTop">
      <div className="orderRowMain">
        <b>{u.email || "(tanpa email)"}</b>
        <span className="paymentOrderId">UID: {u.uid}</span>
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
    </div>
  </article>;
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
  const [tab,setTab]=useState("signal");
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

      {tab==="admin" && admin && <>
        <WinrateCard stats={stats}/>
        <AdminStatusPanel token={adminToken} status={adminStatus} onUpdated={loadAdminStatus}/>
        <AdminPanel latest={latest} history={history} onPublished={()=>loadSignals()} token={adminToken} setToken={setAdminToken} onSetResult={setSignalResult} busyResultId={busyResultId}/>
        <AdminOrders token={adminToken}/>
        <AdminUsers token={adminToken}/>
      </>}

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
