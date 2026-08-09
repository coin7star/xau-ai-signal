import { useEffect, useState } from "react";
import { Activity, Bell, Bot, CheckCircle2, Crown, Send, Shield, Sparkles, TrendingUp, Zap } from "lucide-react";

const FREE_PLAN = {
  code: "FREE",
  label: "Feed Gratis",
  price: "Rp0",
  period: "selamanya",
  tagline: "Buat yang mau lihat-lihat dulu.",
  features: [
    "Lihat feed sinyal & riwayat call",
    "Akses AI assistant (baca konteks setup)",
    "Tanpa alert Telegram real-time"
  ],
  cta: "Mulai Gratis",
  featured: false,
  promo: null
};

// Copy per kode paket (dipakai kalau admin belum ganti apa-apa). Kalau admin
// nambah kode baru yang belum ada di sini, otomatis fallback ke DEFAULT_COPY.
const PLAN_COPY = {
  "7D": {
    tagline: "Coba dulu sebelum langganan penuh.",
    features: ["Semua fitur Free", "Alert Telegram real-time tiap call baru", "Notifikasi hasil (TP/SL/BE)"]
  },
  "30D": {
    tagline: "Paling hemat buat langganan rutin.",
    features: ["Semua fitur 7 Hari", "Prioritas dukungan admin", "Hemat dibanding perpanjang mingguan"]
  }
};
const DEFAULT_COPY = {
  tagline: "Aktifkan alert Telegram real-time buat call berikutnya.",
  features: ["Semua fitur Free", "Alert Telegram real-time tiap call baru", "Notifikasi hasil (TP/SL/BE)"]
};

// Dipakai sebelum fetch /api/pricing selesai (atau kalau API gagal), biar
// halaman beranda tetap langsung nampilin harga tanpa nunggu/blank.
const FALLBACK_PAID_PACKAGES = [
  { code: "7D", label: "7 Hari", priceLabel: "Rp10K", durationDays: 7, promo: null },
  { code: "30D", label: "30 Hari", priceLabel: "Rp30K", durationDays: 30, promo: null }
];

const PILLARS = [
  {
    icon: <TrendingUp size={20} />,
    title: "Dianalisa manual, bukan bot buta",
    body: "Setiap call dibaca & diterbitkan langsung oleh admin berdasarkan struktur market, bukan sinyal otomatis tanpa pengawasan."
  },
  {
    icon: <Bot size={20} />,
    title: "Dibantu AI buat baca konteks",
    body: "AI assistant menjelaskan bias, risiko, dan checklist dari setiap setup yang diterbitkan — bantu kamu paham alasan di baliknya."
  },
  {
    icon: <Bell size={20} />,
    title: "Alert Telegram real-time",
    body: "Subscriber premium langsung dapat notifikasi Telegram begitu call baru terbit, plus update saat TP/SL/BE kena."
  }
];

const STEPS = [
  { n: "01", title: "Daftar & verifikasi email", body: "Buat akun pakai email, klik link verifikasi yang dikirim ke inbox kamu." },
  { n: "02", title: "Pilih paket langganan", body: "Mulai gratis buat lihat feed, atau langsung aktifkan alert Telegram dengan paket 7 / 30 hari." },
  { n: "03", title: "Terima sinyal + insight AI", body: "Setiap call baru masuk otomatis ke dashboard & Telegram, lengkap dengan penjelasan AI assistant." }
];

function ExampleSignalCard() {
  return (
    <div className="heroExampleCard buy">
      <div className="heroExampleTag">
        <span>CONTOH TAMPILAN</span>
      </div>
      <div className="signalHead">
        <div>
          <span className="eyebrow">LATEST CALL</span>
          <h2>BUY</h2>
        </div>
        <div className="liveBadge"><span/> LIVE FEED</div>
      </div>
      <div className="signalMeta">
        <span>XAUUSD</span><span>M15</span><span>OPEN</span>
      </div>
      <div className="priceGrid">
        <div><small>ENTRY</small><strong>3345.20</strong></div>
        <div><small>STOP LOSS</small><strong>3338.00</strong></div>
        <div><small>TAKE PROFIT</small><strong>3360.00</strong></div>
        <div><small>CONFIDENCE</small><strong>85%</strong></div>
      </div>
      <div className="signalNote">Break structure + retest area demand, konfirmasi candle bullish di M15.</div>
    </div>
  );
}

export default function Landing({ onGetStarted }) {
  const [paidPackages, setPaidPackages] = useState(null); // null = belum selesai fetch, pakai fallback dulu

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/pricing");
        const data = await res.json();
        if (alive && data.ok && Array.isArray(data.packages) && data.packages.length) {
          setPaidPackages(data.packages);
        }
      } catch {
        // biarin, tetap pakai FALLBACK_PAID_PACKAGES di bawah
      }
    })();
    return () => { alive = false; };
  }, []);

  const paid = paidPackages || FALLBACK_PAID_PACKAGES;
  const maxDuration = Math.max(...paid.map((p) => Number(p.durationDays) || 0), 0);
  const PLANS = [
    FREE_PLAN,
    ...paid.map((p) => {
      const copy = PLAN_COPY[p.code] || DEFAULT_COPY;
      return {
        code: p.code,
        label: p.label,
        price: p.priceLabel,
        period: `/ ${p.durationDays} hari`,
        tagline: copy.tagline,
        features: copy.features,
        cta: `Pilih ${p.label}`,
        featured: Number(p.durationDays) === maxDuration,
        promo: p.promo || null
      };
    })
  ];

  return (
    <main className="landing">
      <header className="landingNav">
        <div className="brand">
          <div className="brandLogo">X</div>
          <div><b>XAU AI SIGNAL</b><span>Manual signal desk</span></div>
        </div>
        <button className="primaryBtn" onClick={onGetStarted}>Masuk / Daftar</button>
      </header>

      <section className="landingHero">
        <div className="landingHeroCopy">
          <div className="pill"><Zap size={13}/> XAUUSD • MANUAL + AI</div>
          <h1>Sinyal gold, dibaca analis.<br/><span>Dijelaskan AI.</span></h1>
          <p className="muted">Setiap call dianalisa manual oleh admin, lalu AI assistant bantu jelasin konteksnya — bukan sinyal robot tanpa alasan. Subscriber premium dapat alert Telegram detik itu juga.</p>
          <div className="landingHeroActions">
            <button className="primaryBtn" onClick={onGetStarted}>Mulai Gratis <Send size={15}/></button>
            <a href="#harga" className="ghostBtn">Lihat Harga</a>
          </div>
          <div className="welcomeStats">
            <span><Activity size={15}/> Live feed</span>
            <span><Bot size={15}/> AI assistant</span>
            <span><Crown size={15}/> Premium alert</span>
          </div>
        </div>
        <div className="landingHeroVisual">
          <ExampleSignalCard/>
        </div>
      </section>

      <section className="landingSection">
        <div className="landingSectionHead">
          <span className="eyebrow">KENAPA XAU AI SIGNAL</span>
          <h2>Dua lapisan, satu keputusan lebih jelas.</h2>
        </div>
        <div className="pillarGrid">
          {PILLARS.map((p) => (
            <div className="pillarCard newCard" key={p.title}>
              <div className="pillarIcon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landingSection">
        <div className="landingSectionHead">
          <span className="eyebrow">CARA MULAI</span>
          <h2>Tiga langkah, langsung jalan.</h2>
        </div>
        <div className="stepGrid">
          {STEPS.map((s) => (
            <div className="stepCard" key={s.n}>
              <span className="stepNum">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landingSection" id="harga">
        <div className="landingSectionHead">
          <span className="eyebrow">HARGA</span>
          <h2>Pilih paket sesuai kebutuhan.</h2>
        </div>
        <div className="pricingGrid">
          {PLANS.map((plan) => (
            <div className={`pricingCard newCard ${plan.featured ? "featured" : ""}`} key={plan.code}>
              {plan.featured && <div className="pricingBadge">Paling hemat</div>}
              <span className="eyebrow">{plan.label}</span>
              {plan.promo && <span className="landingPromoBadge">{plan.promo.label}</span>}
              <div className="pricingPrice">
                {plan.promo?.originalPriceLabel && <s className="promoOldPrice">{plan.promo.originalPriceLabel}</s>}
                <strong>{plan.price}</strong><span>{plan.period}</span>
              </div>
              <p className="muted">{plan.tagline}</p>
              <ul className="pricingFeatures">
                {plan.features.map((f) => (
                  <li key={f}><CheckCircle2 size={15}/> {f}</li>
                ))}
              </ul>
              <button className={plan.featured ? "primaryBtn" : "ghostBtn"} onClick={onGetStarted}>{plan.cta}</button>
            </div>
          ))}
        </div>
        <p className="landingDisclaimer"><Shield size={14}/> Trading XAUUSD berisiko tinggi dan bisa mengakibatkan kerugian. Sinyal di sini adalah informasi analisa, bukan jaminan profit — selalu gunakan manajemen risiko sendiri.</p>
      </section>

      <section className="landingCta">
        <Sparkles size={22}/>
        <h2>Siap mulai baca market lebih jelas?</h2>
        <button className="primaryBtn" onClick={onGetStarted}>Buat Akun Sekarang</button>
      </section>

      <footer><span>XAU AI SIGNAL</span> • Signal information & AI assistance • Trading dengan risk management.</footer>
    </main>
  );
}
