const H = {
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type, Authorization"
};

export async function onRequest({request,env}) {
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:H});
  const dbUrl=(env.FIREBASE_DATABASE_URL||env.VITE_FIREBASE_DATABASE_URL||"").replace(/\/$/,"");
  if(!dbUrl) return json({ok:false,error:"FIREBASE_DATABASE_URL belum diset"},500);

  let accessToken=null;
  try{
    const service=readServiceAccount(env);
    if(service) accessToken=await getGoogleAccessToken(service);
  }catch(e){
    return json({ok:false,error:`Gagal ambil Firebase service-account token: ${e?.message||e}`},500);
  }

  try{
    if(request.method==="GET"){
      const status=await fbGet(dbUrl,"/adminStatus",accessToken);
      return json({ok:true,online:Boolean(status?.online),message:status?.message||"",updatedAt:status?.updatedAt||null});
    }

    if(request.method!=="POST") return json({ok:false,error:"Method not allowed"},405);

    const adminToken=env.ADMIN_ACTION_TOKEN||env.VITE_ADMIN_ACTION_TOKEN||"";
    const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
    if(!adminToken || token!==adminToken) return json({ok:false,error:"Unauthorized admin token"},401);

    let body={};
    try{body=await request.json()}catch{return json({ok:false,error:"Body JSON tidak valid"},400)}

    const online=Boolean(body.online);
    const message=safeText(body.message||"");
    const now=new Date().toISOString();
    const status={online,message,updatedAt:now};
    await fbPut(dbUrl,"/adminStatus",status,accessToken);

    let notifications=null;
    if(body.broadcastTelegram && online && message){
      notifications=await notifyStatusTelegram(env,dbUrl,message,accessToken);
    }

    return json({ok:true,...status,notifications});
  }catch(e){
    console.error("admin-status error",e);
    return json({ok:false,error:e?.message||"Terjadi kesalahan tak terduga di server."},500);
  }
}

async function notifyStatusTelegram(env,dbUrl,message,accessToken){
  const token=env.TELEGRAM_BOT_TOKEN||"";
  if(!token) return {ok:false,skipped:true,reason:"TELEGRAM_BOT_TOKEN missing",totalRecipients:0,successCount:0,failedCount:0};
  const raw=await fbGet(dbUrl,"/users",accessToken);
  const users=Object.values(raw||{}).filter(isPremiumConnected);
  const seen=new Set();
  const recipients=users.filter(u=>{const id=String(u.telegramChatId);if(!id||seen.has(id))return false;seen.add(id);return true});

  const text=[
    "🟢 <b>MIMIN ONLINE</b>","",
    escapeHtml(message),"",
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
function safeText(v){return String(v??"").trim().slice(0,300)}
function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}

async function fbGet(dbUrl,path,accessToken){
  const url=new URL(`${dbUrl}${path}.json`);
  url.searchParams.set("ts",String(Date.now()));
  if(accessToken) url.searchParams.set("access_token",accessToken);
  const r=await fetch(url.toString(),{headers:{"Cache-Control":"no-cache"}});
  if(!r.ok){
    const body=await r.text().catch(()=> "");
    throw new Error(`Firebase GET ${path} gagal (${r.status}): ${body.slice(0,180)}`);
  }
  return await r.json();
}
async function fbPut(dbUrl,path,data,accessToken){
  const url=new URL(`${dbUrl}${path}.json`);
  if(accessToken) url.searchParams.set("access_token",accessToken);
  const r=await fetch(url.toString(),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  if(!r.ok){
    const body=await r.text().catch(()=> "");
    throw new Error(`Firebase PUT ${path} gagal (${r.status}): ${body.slice(0,180)}`);
  }
  return await r.json();
}
function json(payload,status=200){return new Response(JSON.stringify(payload,null,2),{status,headers:{...H,"Cache-Control":"no-store"}})}

function readServiceAccount(env){
  const jsonRaw=env.FIREBASE_SERVICE_ACCOUNT_JSON||env.FIREBASE_SERVICE_ACCOUNT||env.FIREBASE_ADMIN_SERVICE_ACCOUNT||"";
  if(jsonRaw){
    try{
      const parsed=JSON.parse(jsonRaw);
      return normalizeServiceAccount({
        projectId:parsed.project_id||parsed.projectId,
        clientEmail:parsed.client_email||parsed.clientEmail,
        privateKey:parsed.private_key||parsed.privateKey
      });
    }catch{
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak valid.");
    }
  }
  const projectId=env.FIREBASE_PROJECT_ID||env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID||env.FIREBASE_ADMIN_PROJECT_ID||env.VITE_FIREBASE_PROJECT_ID||"";
  const clientEmail=env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL||env.FIREBASE_CLIENT_EMAIL||env.FIREBASE_ADMIN_CLIENT_EMAIL||"";
  const privateKey=env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY||env.FIREBASE_PRIVATE_KEY||env.FIREBASE_ADMIN_PRIVATE_KEY||"";
  if(!projectId||!clientEmail||!privateKey) return null;
  return normalizeServiceAccount({projectId,clientEmail,privateKey});
}
function normalizeServiceAccount({projectId,clientEmail,privateKey}){
  const cleanProjectId=String(projectId||"").trim();
  const cleanClientEmail=String(clientEmail||"").trim();
  const cleanPrivateKey=String(privateKey||"").replace(/\\n/g,"\n").trim();
  if(!cleanProjectId||!cleanClientEmail||!cleanPrivateKey) return null;
  return {projectId:cleanProjectId,clientEmail:cleanClientEmail,privateKey:cleanPrivateKey};
}
async function getGoogleAccessToken(service){
  const now=Math.floor(Date.now()/1000);
  const header={alg:"RS256",typ:"JWT"};
  const payload={
    iss:service.clientEmail,
    scope:"https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,
    exp:now+3600
  };
  const unsigned=`${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature=await signRs256(unsigned,service.privateKey);
  const assertion=`${unsigned}.${signature}`;
  const res=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.access_token){
    throw new Error(data?.error_description||data?.error||"Gagal mengambil Firebase service-account access token.");
  }
  return data.access_token;
}
async function signRs256(input,privateKeyPem){
  const keyData=pemToArrayBuffer(privateKeyPem);
  const key=await crypto.subtle.importKey("pkcs8",keyData,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(input));
  return arrayBufferToBase64Url(signature);
}
function pemToArrayBuffer(pem){
  const clean=String(pem||"").replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s/g,"");
  const binary=atob(clean);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i);
  return bytes.buffer;
}
function base64UrlJson(value){
  return arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)).buffer);
}
function arrayBufferToBase64Url(buffer){
  const bytes=new Uint8Array(buffer);
  let binary="";
  const chunkSize=0x8000;
  for(let i=0;i<bytes.length;i+=chunkSize) binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
