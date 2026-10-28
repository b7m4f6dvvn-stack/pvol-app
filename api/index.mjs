const BASE='https://usximvurnararrwsnbit.supabase.co';
const KEY='sb_publishable_SI8yLXOZL_XXSmm8F7Xvnw_YoJcB-Yh';
const cookies=(req)=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
const cookie=(name,value,age)=>`${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Metoden stöds inte.'});
 const origin=req.headers.origin;const expected='https://'+req.headers.host;
 if(origin!==expected)return res.status(403).json({error:'Ogiltig förfrågan.'});
 try{
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
 const c=cookies(req);let access=c.pvol_access||'',refresh=c.pvol_refresh||'';
 let updated=false;
 if(refresh&&!['login','accept','inviteInfo'].includes(b.action)){
 let exp=0;try{exp=JSON.parse(Buffer.from(access.split('.')[1],'base64url')).exp}catch{}
 if(exp*1000<Date.now()+60000){const r=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})});const d=await r.json();if(!r.ok){res.setHeader('Set-Cookie',[cookie('pvol_access','',0),cookie('pvol_refresh','',0)]);return res.status(401).json({error:'Logga in igen.'})}access=d.access_token;refresh=d.refresh_token;updated=true;}
 }
 const r=await fetch(BASE+'/functions/v1/pvol-api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(access||KEY),'x-forwarded-for':req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown'},body:JSON.stringify(b)});
 const d=await r.json();if(d.session){access=d.session.access_token;refresh=d.session.refresh_token;updated=true;delete d.session;d.ok=true;}
 if(b.action==='logout'||d.reauth){res.setHeader('Set-Cookie',[cookie('pvol_access','',0),cookie('pvol_refresh','',0)]);}else if(updated){res.setHeader('Set-Cookie',[cookie('pvol_access',access,3600),cookie('pvol_refresh',refresh,2592000)])}
 return res.status(r.status).json(d);
 }catch{return res.status(500).json({error:'Tjänsten kunde inte nås. Försök igen.'})}
}
