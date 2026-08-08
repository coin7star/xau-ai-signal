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
    </div>
    <div className="priceGrid">
      <div><small>ENTRY</small><strong>{money(signal.entry)}</strong></div>
      <div><small>STOP LOSS</small><strong>{money(signal.sl)}</strong></div>
      <div><small>TAKE PROFIT</small><strong>{money(signal.tp)}</strong></div>
      <div><small>CONFIDENCE</small><strong>{signal.confidence ? `${signal.confidence}%` : "-"}</strong></div>
    </div>
    <div className="signalNote">{signal.note || signal.reason || "Setup sudah dianalisa manual oleh admin."}</div>
    <div className="signalFooter">
      <span>Dipublish {fmtDate(signal.publishedAt || signal.createdAt)}</span>
      {premium ? <span className="premiumMini"><Crown size={13}/> Premium Alert ON</span> : <span>Premium untuk alert Telegram</span>}
    </div>
  </section>;
}

function Feed({ history, onRefresh }) {
  return <section className="section">
    <div className="sectionHeader"><div><span className="eyebrow">SIGNAL FEED</span><h3>Riwayat call</h3></div><button className="iconBtn" onClick={onRefresh}><RefreshCw size={17}/></button></div>
    <div className="feedList">
      {history.length ? history.map((s,i)=><article className="feedItem" key={s.id || i}>
        <div className={`dir ${isBuy(s.direction)?"buy":isSell(s.direction)?"sell":""}`}>{s.direction || "WAIT"}</div>
        <div className="feedMain"><b>{s.title || `${s.pair || "XAUUSD"} ${s.timeframe || "M15"}`}</b><span>{s.note || s.reason || "Manual setup"}</span></div>
        <div className="feedNums"><b>{money(s.entry)}</b><span>SL {money(s.sl)} • TP {money(s.tp)}</span></div>
        <time>{fmtDate(s.publishedAt || s.createdAt)}</time>
      </article>) : <div className="emptyBox">Belum ada riwayat sinyal.</div>}
    </div>
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

function PremiumBox({ profile, user, refresh }) {
  const premium=isPremiumProfile(profile);
  const [busy,setBusy]=useState(false);
  async function buy(code,label,price) {
    setBusy(true);
    try { await createPaymentOrder({user,profile,packageCode:code,packageLabel:label,price}); alert("Order dibuat. Silakan ikuti instruksi pembayaran/admin."); }
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

function AdminPanel({ latest, history, onPublished }) {
  const [token,setToken]=useState(()=>localStorage.getItem(ADMIN_TOKEN_KEY)||"");
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
  async function closeSignal(){
    if(!latest?.id) return;
    if(!confirm("Tutup sinyal terbaru?")) return;
    setBusy(true);
    try{
      const res=await fetch("/api/admin-signal",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"close",id:latest.id})});
      const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.error||"Gagal menutup.");
      setResult("Sinyal ditutup.");onPublished();
    }catch(e){setResult(`❌ ${e.message}`)}finally{setBusy(false)}
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
      <div className="adminActions"><button className="primaryBtn" disabled={busy||!token}><Send size={17}/> {busy?"Mengirim...":"Publish & Notify Premium"}</button><button type="button" className="dangerBtn" disabled={busy||!latest} onClick={closeSignal}>Tutup Signal</button></div>
      {result && <div className="notice">{result}</div>}
    </form>
  </section>;
}

function AppShell({ user, profile, refreshProfile, profileError }) {
  const [latest,setLatest]=useState(null);
  const [history,setHistory]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState("");
  const premium=isPremiumProfile(profile);
  const admin=profile?.role==="admin";

  async function loadSignals(silent=false){
    if(!silent)setLoading(true);
    try{
      const res=await fetch("/api/admin-signal");
      const data=await res.json();
      if(data.ok){setLatest(data.latest||null);setHistory(data.history||[]);}
    }catch(e){ if(!silent) setToast("Signal feed gagal dimuat.");}
    finally{if(!silent)setLoading(false)}
  }

  useEffect(()=>{loadSignals(); const id=setInterval(()=>loadSignals(true),15000); return()=>clearInterval(id)},[]);
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
      <nav><button className="navBtn active">Signals</button><button className="navBtn" onClick={enableNotif}><Bell size={16}/> Alerts</button>{admin&&<a className="navBtn" href="#admin">Admin</a>}<button className="navBtn ghost" onClick={logout}><LogOut size={16}/></button></nav>
    </header>

    <main className="container">
      <section className="welcome">
        <div><span className="eyebrow">XAUUSD • MANUAL CALL CENTER</span><h1>Informasi sinyal, <span>tanpa ribet.</span></h1><p>Admin menganalisa market secara manual. Setelah call diterbitkan, signal tampil di sini dan subscriber premium langsung menerima alert Telegram.</p><div className="welcomeStats"><span><Activity size={15}/> Live feed</span><span><Bot size={15}/> AI assistant</span><span><Crown size={15}/> Premium alert</span></div></div>
        <div className="miniPanel"><div className="miniTop"><span>ACCOUNT</span><span className={premium?"status premium":"status"}>{premium?"PREMIUM":"FREE"}</span></div><b>{user.email||"User"}</b><small>{profile?.telegramConnected?"Telegram connected":"Telegram not connected"}</small></div>
      </section>

      {toast && <div className="toast"><Bell size={17}/>{toast}<button onClick={()=>setToast("")}><X size={15}/></button></div>}
      {profileError && <div className="notice error profileNotice">Akses akun belum terbaca. Silakan refresh halaman.</div>}

      {loading ? <div className="loadingCard newCard"><RefreshCw className="spin"/><span>Memuat signal feed...</span></div> : <SignalCard signal={latest} premium={premium}/>}

      <PremiumBox profile={profile} user={user} refresh={refreshProfile}/>

      <Feed history={history} onRefresh={()=>loadSignals()}/>
      <AiPanel signal={latest}/>

      {admin && <div id="admin"><AdminPanel latest={latest} history={history} onPublished={()=>loadSignals()}/></div>}

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
