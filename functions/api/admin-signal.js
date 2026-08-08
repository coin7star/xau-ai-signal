const H = {
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type, Authorization"
};

export async function onRequest({request,env}) {
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:H});
  const dbUrl=(env.FIREBASE_DATABASE_URL||"").replace(/\/$/,"");
  if(!dbUrl) return json({ok:false,error:"FIREBASE_DATABASE_URL belum diset"},500);

  if(request.method==="GET"){
    const latest=await fbGet(dbUrl,"/manualSignals/latest");
    const raw=await fbGet(dbUrl,"/manualSignals/history");
    const history=Object.values(raw||{}).filter(Boolean)
      .sort((a,b)=>new Date(b.publishedAt||b.createdAt||0)-new Date(a.publishedAt||a.createdAt||0))
      .slice(0,30);
    return json({ok:true,latest:latest||null,history});
  }

  if(request.method!=="POST") return json({ok:false,error:"Method not allowed"},405);

  const adminToken=env.ADMIN_ACTION_TOKEN||env.VITE_ADMIN_ACTION_TOKEN||"";
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!adminToken || token!==adminToken) return json({ok:false,error:"Unauthorized admin token"},401);

  let body={};
  try{body=await request.json()}catch{return json({ok:false,error:"Body JSON tidak valid"},400)}
  const action=String(body.action||"publish").toLowerCase();

  if(action==="close"){
    const latest=await fbGet(dbUrl,"/manualSignals/latest");
    if(!latest?.id) return json({ok:false,error:"Belum ada signal aktif"},404);
    const closed={...latest,status:"CLOSED",closedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await fbPut(dbUrl,"/manualSignals/latest",closed);
    await fbPatch(dbUrl,`/manualSignals/history/${safeKey(latest.id)}`,{status:"CLOSED",closedAt:closed.closedAt,updatedAt:closed.updatedAt});
    return json({ok:true,signal:closed});
  }

  const direction=String(body.direction||"").toUpperCase();
  if(!["BUY","SELL"].includes(direction)) return json({ok:false,error:"direction harus BUY atau SELL"},400);

  const entry=cleanNumber(body.entry), sl=cleanNumber(body.sl), tp=cleanNumber(body.tp);
  if(!Number.isFinite(entry)||!Number.isFinite(sl)||!Number.isFinite(tp)) return json({ok:false,error:"Entry, SL, TP wajib berupa angka"},400);

  const now=new Date().toISOString();
  const id=`SIG-${Date.now()}`;
  const signal={
    id,pair:"XAUUSD",direction,
    timeframe:String(body.timeframe||"M15"),
    entry,sl,tp,
    confidence:Math.max(1,Math.min(100,Number(body.confidence||80))),
    title:safeText(body.title||`${direction} XAUUSD`),
    note:safeText(body.note||"Manual setup oleh admin"),
    status:"OPEN",
    publishedAt:now,
    createdAt:now,
    source:"manual-admin"
  };

  await fbPut(dbUrl,"/manualSignals/latest",signal);
  await fbPut(dbUrl,`/manualSignals/history/${safeKey(id)}`,signal);

  const notifications=await notifyPremiumTelegram(env,dbUrl,signal);

  return json({ok:true,signal,notifications});
}

async function notifyPremiumTelegram(env,dbUrl,signal){
  const token=env.TELEGRAM_BOT_TOKEN||"";
  if(!token) return {ok:false,skipped:true,reason:"TELEGRAM_BOT_TOKEN missing",totalRecipients:0,successCount:0,failedCount:0};
  const raw=await fbGet(dbUrl,"/users");
  const users=Object.values(raw||{}).filter(isPremiumConnected);
  const seen=new Set();
  const recipients=users.filter(u=>{const id=String(u.telegramChatId);if(!id||seen.has(id))return false;seen.add(id);return true});
  const text=[
    "🚨 <b>XAU AI SIGNAL — NEW CALL</b>","",
    `<b>${escapeHtml(signal.direction)} ${escapeHtml(signal.pair)}</b>`,
    `Timeframe: <b>${escapeHtml(signal.timeframe)}</b>`,
    `Entry: <b>${signal.entry}</b>`,
    `SL: <b>${signal.sl}</b>`,
    `TP: <b>${signal.tp}</b>`,
    `Confidence: <b>${signal.confidence}%</b>`,
    "",
    escapeHtml(signal.note||"Manual setup"),
    "",
    "👑 Premium Alert • XAU AI Signal"
  ].join("\n");
  let successCount=0,failedCount=0;
  for(const u of recipients){
    try{
      const res=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({chat_id:String(u.telegramChatId),text,parse_mode:"HTML",disable_web_page_preview:true})
      });
      if(res.ok) successCount++; else failedCount++;
    }catch{failedCount++}
  }
  return {ok:failedCount===0,totalRecipients:recipients.length,successCount,failedCount};
}

function isPremiumConnected(u){
  if(!u?.telegramConnected||!u?.telegramChatId)return false;
  if(u.status&&u.status!=="active")return false;
  if(u.role==="admin")return true;
  if(u.role!=="premium")return false;
  const until=u.premiumUntil||u.expiredAt;
  return Boolean(until)&&new Date(until).getTime()>Date.now();
}
function cleanNumber(v){const n=Number(String(v??"").replace(/,/g,""));return n}
function safeText(v){return String(v??"").trim().slice(0,1000)}
function safeKey(v){return String(v).replace(/[.#$[\]/:]/g,"_")}
function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
async function fbGet(dbUrl,path){const r=await fetch(`${dbUrl}${path}.json?ts=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});if(!r.ok)return null;return await r.json()}
async function fbPut(dbUrl,path,data){const r=await fetch(`${dbUrl}${path}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw new Error(await r.text());return await r.json()}
async function fbPatch(dbUrl,path,data){const r=await fetch(`${dbUrl}${path}.json`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw new Error(await r.text());return await r.json()}
function json(payload,status=200){return new Response(JSON.stringify(payload,null,2),{status,headers:{...H,"Cache-Control":"no-store"}})}
