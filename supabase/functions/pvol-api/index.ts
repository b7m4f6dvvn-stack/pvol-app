import {createClient} from 'npm:@supabase/supabase-js@2.95.3';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function fail(message:string,status=400):never{throw {message,status}}
function str(x:unknown,max:number,min=0){if(typeof x!=='string'||x.trim().length<min||x.length>max)fail('Kontrollera text och obligatoriska fält.');return x.trim()}
async function result(q:any){const {data,error}=await q;if(error)throw Error('Database operation failed');return data}
function pwd(x:unknown,min=1){if(typeof x!=='string'||x.length<min||x.length>256)fail('Kontrollera lösenordets längd.');return x}
const cats=['Övrigt','Förslagslåda','Förbättringsförslag','Mötesfrågor','Luckans loggbok','Luckans morgonbön','Truckar','Plock','Inlägg','Moppe','Utkör','Avrop','Luckan','Brist','Däck'];
Deno.serve(async req=>{try{
 if(req.method!=='POST')return json({error:'Metoden stöds inte.'},405);
 if(Number(req.headers.get('content-length')||0)>7500000)fail('För stor förfrågan.',413);
 const b=await req.json(); const action=b.action;
 if(['login','accept','inviteInfo'].includes(action)){
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const n=await result(db.rpc('pvol_throttle',{k:await hash(ip+':'+Math.floor(Date.now()/900000))}));if(n>40)fail('För många försök. Vänta 15 minuter.',429);
 }
 if(action==='login'){
 const email=str(b.email,254,3).toLowerCase(),password=pwd(b.password);
 const {data,error}=await createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInWithPassword({email,password});if(error||!data.session)fail('Fel e-postadress eller lösenord.',401);
 const m=await result(db.from('pvol_members').select('*').eq('user_id',data.user.id).eq('active',true).maybeSingle());if(!m)fail('Kontot saknar aktivt medlemskap.',403);
 return json({session:data.session});
 }
 if(action==='inviteInfo'||action==='accept'){
 const token=str(b.token,128,40),h=await hash(token);
 const invite=await result(db.from('pvol_invites').select('*').eq('token_hash',h).is('used_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());if(!invite)fail('Länken är använd, återkallad eller har gått ut.',410);
 if(action==='inviteInfo')return json({name:invite.display_name,recovery:!!invite.target_user});
 const password=pwd(b.password,12);if(!/[a-zA-ZåäöÅÄÖ]/.test(password)||!/[0-9]/.test(password))fail('Använd minst 12 tecken, bokstäver och siffror.');
 let uid=invite.target_user,email='';const displayName=uid?null:str(b.name??invite.display_name,80,1);
 if(uid){const m=await result(db.from('pvol_members').select('active').eq('user_id',uid).single());if(!m.active)fail('Kontot är avstängt.',403);const u=await db.auth.admin.getUserById(uid);email=u.data.user?.email||'';
 await result(db.rpc('pvol_accept',{h,u:uid}));
 const {error}=await db.auth.admin.updateUserById(uid,{password,email_confirm:true});if(error)fail('Lösenordet kunde inte ändras. Be huvudadmin skapa en ny länk.',500);
 await db.rpc('pvol_revoke_sessions',{u:uid});
 // Remove all prior refresh sessions after recovery.
 await db.from('pvol_invites').update({revoked_at:new Date().toISOString()}).eq('target_user',uid).is('used_at',null);
 }else{
 email=str(b.email,254,3).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Ange giltig e-postadress.');
 const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)fail('Kontot kunde inte skapas. Adressen kan redan vara registrerad.');uid=data.user.id;
 try{await result(db.rpc('pvol_accept',{h,u:uid}));}catch{await db.auth.admin.deleteUser(uid);fail('Länken kunde inte användas. Den kan redan vara använd.',409)}
 }
 if(displayName)await result(db.from('pvol_members').update({display_name:displayName}).eq('user_id',uid));
 const {data,error}=await createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInWithPassword({email,password});if(error||!data.session)fail('Lösenordet sparades. Logga in med din e-postadress och lösenord.',400);return json({session:data.session});
 }
 const jwt=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 const {data:auth,error:authError}=await db.auth.getUser(jwt);if(authError||!auth.user)fail('Logga in först.',401);
 const uid=auth.user.id;
 // Check session revocation, even while an old JWT is still valid.
 let sid='';try{sid=JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{}
 const sessionOK=await result(db.rpc('pvol_session_active',{sid,uid}));if(!sessionOK)fail('Sessionen har avslutats. Logga in igen.',401);
 const me=await result(db.from('pvol_members').select('*').eq('user_id',uid).eq('active',true).maybeSingle());if(!me)fail('Ditt medlemskap är avstängt.',403);
 const admin=['admin','owner'].includes(me.role),owner=me.role==='owner';
 const requireAdmin=()=>{if(!admin)fail('Endast administratörer kan göra detta.',403)};
 const requireOwner=()=>{if(!owner)fail('Endast huvudadmin kan göra detta.',403)};
 if(action==='profile'){const row:any={display_name:str(b.name,80,1)};if(b.birth_day!==undefined||b.birth_month!==undefined){let birthday=null;if(b.birth_day||b.birth_month){const day=Number(b.birth_day),month=Number(b.birth_month),probe=new Date(Date.UTC(2000,month-1,day));if(!Number.isInteger(day)||!Number.isInteger(month)||day<1||month<1||month>12||probe.getUTCDate()!==day||probe.getUTCMonth()!==month-1)fail('Kontrollera födelsedagens dag och månad.');birthday=String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')}row.birthday_mmdd=birthday}await result(db.from('pvol_members').update(row).eq('user_id',uid));return json({ok:true})}
 if(action==='logout'){await db.auth.admin.signOut(jwt,'local');return json({ok:true})}
 if(action==='state'){
 const [posts,comments,events,instructions,members,attendance,meetings,chat,phones,trucks,settings]=await Promise.all([
 result(db.from('pvol_posts').select('*').order('created_at',{ascending:false}).limit(200)),result(db.from('pvol_comments').select('*').order('created_at').limit(2000)),result(db.from('pvol_events').select('*').order('starts_at').limit(500)),result(db.from('pvol_instructions').select('*').order('title')),result(db.from('pvol_members').select('user_id,display_name,role,active,birthday_mmdd').order('display_name')),result(db.from('pvol_attendance').select('*').order('start_date',{ascending:false})),result(db.from('pvol_meeting_changes').select('*')),result(db.from('pvol_chat').select('*').order('created_at',{ascending:false}).limit(300)),result(db.from('pvol_phones').select('*').order('category').order('name')),result(db.from('pvol_trucks').select('*').order('truck_number')),result(db.from('pvol_settings').select('job_order').eq('id',true).maybeSingle())]);
 const invites=admin?await result(db.from('pvol_invites').select('id,display_name,expires_at,used_at,revoked_at,target_user').order('created_at',{ascending:false}).limit(100)):[];
 const signed=posts.filter((p:any)=>p.image).map((p:any)=>p.image);
 const images=signed.length?await db.storage.from('pvol-images').createSignedUrls(signed,300):{data:[]};
 return json({me:{...me,email:auth.user.email},posts:posts.map((p:any)=>({...p,imageURL:images.data?.find((i:any)=>i.path===p.image)?.signedUrl||null})),comments,events,instructions,members,attendance:attendance.map((a:any)=>({...a,note:a.user_id===uid?a.note:''})),meetings,invites,chat,phones,trucks,jobOrder:settings?.job_order||[]});
 }
 if(action==='invite'){
 requireAdmin();const name=str(b.name,80,1);let target=null;
 if(b.target){requireOwner();const m=await result(db.from('pvol_members').select('*').eq('user_id',b.target).single());if(!m.active)fail('Aktivera kontot först.');target=m.user_id;}
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
 await result(db.from('pvol_invites').insert({token_hash:await hash(token),display_name:name,created_by:uid,target_user:target}));return json({token});
 }
 if(action==='revokeInvite'){requireAdmin();await result(db.from('pvol_invites').update({revoked_at:new Date().toISOString()}).eq('id',b.id));return json({ok:true})}
 if(action==='member'){
 requireOwner();if(b.id===uid)fail('Huvudadmin kan inte ändra sitt eget medlemskap.');const target=await result(db.from('pvol_members').select('*').eq('user_id',b.id).single());if(target.role==='owner')fail('Huvudadmin är skyddad.');if(!['member','admin'].includes(b.role)||typeof b.active!=='boolean')fail('Ogiltig behörighet.');
 await result(db.from('pvol_members').update({role:b.role,active:b.active,display_name:str(b.name,80,1)}).eq('user_id',b.id));
 if(!b.active){await db.rpc('pvol_revoke_sessions',{u:b.id});await db.from('pvol_invites').update({revoked_at:new Date().toISOString()}).eq('target_user',b.id).is('used_at',null)}return json({ok:true});
 }
 if(action==='password'){
 const password=pwd(b.password,12),current=pwd(b.current);if(!/[0-9]/.test(password)||!/[a-zA-Zåäö]/i.test(password))fail('Använd bokstäver och siffror.');
 const probe=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const check=await probe.auth.signInWithPassword({email:auth.user.email!,password:current});if(check.error)fail('Nuvarande lösenord stämmer inte.',403);await probe.auth.signOut();const changed=await db.auth.admin.updateUserById(uid,{password});if(changed.error)fail('Kunde inte ändra lösenordet.');await db.rpc('pvol_revoke_sessions',{u:uid});return json({ok:true,reauth:true});
 }
 if(action==='post'){
 const body=str(b.body,5000,1),category=b.category==='AW'?'Övrigt':cats.includes(b.category)?b.category:'Inlägg';
 if(category==='Inlägg')requireAdmin();
 if(b.id){const existing=await result(db.from('pvol_posts').select('category').eq('id',b.id).single());if(existing?.category==='Inlägg')requireAdmin();let q=db.from('pvol_posts').update({body,category}).eq('id',b.id);if(!admin)q=q.eq('author',uid);const rows=await result(q.select('id'));if(!rows.length)fail('Inlägget saknas eller tillhör någon annan.',403);return json({ok:true})}
 let image=null;if(b.image){if(typeof b.image!=='string'||b.image.length>7000000)fail('Bilden är för stor.');const bytes=Uint8Array.from(atob(b.image),x=>x.charCodeAt(0));let ext='';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)ext='png';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')ext='webp';if(!ext||bytes.length>5000000)fail('Välj JPG, PNG eller WebP under 5 MB.');image=uid+'/'+crypto.randomUUID()+'.'+ext;const upload=await db.storage.from('pvol-images').upload(image,bytes,{contentType:ext==='jpg'?'image/jpeg':'image/'+ext});if(upload.error)fail('Bilden kunde inte laddas upp.',500)}
 try{await result(db.from('pvol_posts').insert({author:uid,body,category,image}));}catch(e){if(image)await db.storage.from('pvol-images').remove([image]);throw e}return json({ok:true});
 }
 if(action==='editComment'){let q=db.from('pvol_comments').update({body:str(b.body,1000,1)}).eq('id',b.id);if(!admin)q=q.eq('author',uid);const rows=await result(q.select('id'));if(!rows.length)fail('Kommentaren saknas eller tillhör någon annan.',403);return json({ok:true})}
 if(action==='comment'){await result(db.from('pvol_comments').insert({author:uid,post_id:str(b.post,36,36),body:str(b.body,1000,1)}));return json({ok:true})}
 if(action==='deletePost'||action==='deleteComment'){
 const table=action==='deletePost'?'pvol_posts':'pvol_comments';const item=await result(db.from(table).select('*').eq('id',b.id).single());if(action==='deletePost'&&item.category==='Inlägg')requireAdmin();if(item.author!==uid&&!admin)fail('Du kan bara radera ditt eget innehåll.',403);await result(db.from(table).delete().eq('id',b.id));if(item.image)await db.storage.from('pvol-images').remove([item.image]);return json({ok:true});
 }
 if(action==='event'){requireAdmin();const starts=str(b.starts,40,1);if(!Number.isFinite(Date.parse(starts)))fail('Ogiltigt datum.');const row={title:str(b.title,150,1),starts_at:starts,location:str(b.location,200),description:str(b.body,3000),cancelled:b.cancelled===true,author:uid};await result(b.id?db.from('pvol_events').update(row).eq('id',b.id):db.from('pvol_events').insert(row));return json({ok:true})}
 if(action==='instruction'){requireAdmin();const row={title:str(b.title,150,1),category:str(b.category,40,1),body:str(b.body,10000,1),author:uid,updated_at:new Date().toISOString()};await result(b.id?db.from('pvol_instructions').update(row).eq('id',b.id):db.from('pvol_instructions').insert(row));return json({ok:true})}
 if(action==='deleteEvent'||action==='deleteInstruction'){requireAdmin();await result(db.from(action==='deleteEvent'?'pvol_events':'pvol_instructions').delete().eq('id',b.id));return json({ok:true})}
 if(action==='meeting'){requireAdmin();if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!['morgon','avdelning'].includes(b.type))fail('Ogiltigt möte.');await result(db.from('pvol_meeting_changes').upsert({meeting_date:b.date,meeting_type:b.type,location:str(b.location,200),cancelled:b.cancelled===true,cancellation_reason:str(b.reason,500),updated_by:uid}));return json({ok:true})}
 if(action==='attendance'){
 if(!['Jobbar','Sjuk','VAB','Ledig','Semester','Möte','Fackligt jobb','Annat'].includes(b.status))fail('Välj en giltig orsak.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.start)||!/^\d{4}-\d{2}-\d{2}$/.test(b.end)||!Number.isFinite(Date.parse(b.start))||!Number.isFinite(Date.parse(b.end))||b.start>b.end)fail('Kontrollera datumen.');
 const startTime=b.start_time??(b.status==='Jobbar'?'00:00':null),endTime=b.end_time??(b.status==='Jobbar'?'23:59':null);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime||'')||b.start===b.end&&startTime>=endTime)fail('Ange giltiga klockslag och en sluttid efter starttiden.');
 await result(db.from('pvol_attendance').insert({user_id:uid,start_date:b.start,end_date:b.end,start_time:startTime,end_time:endTime,status:b.status,note:str(b.note,1000)}));return json({ok:true})}

 if(action==='jobOrder'){requireAdmin();const jobs=['Övrigt','Truckar','Plock','Inlägg','Moppe','Utkör','Avrop','Luckan','Brist','Däck'];if(!Array.isArray(b.order)||b.order.length!==jobs.length||new Set(b.order).size!==jobs.length||b.order.some((x:any)=>!jobs.includes(x)))fail('Ordningen måste innehålla varje jobb exakt en gång.');await result(db.from('pvol_settings').upsert({id:true,job_order:b.order,updated_by:uid,updated_at:new Date().toISOString()}));return json({ok:true})}
 if(action==='truck'){requireAdmin();const number=str(b.truck_number,30,1).toUpperCase();if(!/^[A-Z0-9ÅÄÖ ._-]+$/.test(number))fail('Kontrollera trucknumret.');const {error}=await db.from('pvol_trucks').insert({truck_number:number,updated_by:uid});if(error){if(error.code==='23505')fail('Trucknumret finns redan.',409);throw error}return json({ok:true})}
 if(action==='truckStatus'){if(!['I drift','Felanmäld','På reparation'].includes(b.status))fail('Välj en giltig truckstatus.');const rows=await result(db.from('pvol_trucks').update({status:b.status,note:str(b.note,1000),updated_by:uid,updated_at:new Date().toISOString()}).eq('id',str(b.id,36,36)).eq('updated_at',str(b.version,50,1)).select('id'));if(!rows.length)fail('Trucklistan har ändrats. Uppdatera sidan innan du sparar igen.',409);return json({ok:true})}
 if(action==='chat'){await result(db.from('pvol_chat').insert({author:uid,body:str(b.body,2000,1)}));return json({ok:true})}
 if(action==='phone'){
 const phone=str(b.phone,40,1);if(!/^\+?[0-9 ()-]+$/.test(phone)||!/[0-9]/.test(phone))fail('Ange ett giltigt telefonnummer.');
 const row={name:str(b.name,120,1),category:str(b.category,80,1),phone,description:str(b.description,500)};
 if(b.id){const rows=await result(db.from('pvol_phones').update(row).eq('id',b.id).select('id'));if(!rows.length)fail('Numret finns inte kvar.',404)}else await result(db.from('pvol_phones').insert({...row,author:uid}));return json({ok:true});
 }
 if(action==='deleteChat'||action==='deletePhone'){const table=action==='deleteChat'?'pvol_chat':'pvol_phones';let q=db.from(table).delete().eq('id',b.id);if(!admin)q=q.eq('author',uid);const rows=await result(q.select('id'));if(!rows.length)fail('Du kan bara ta bort ditt eget innehåll.',403);return json({ok:true})}

 if(action==='deleteAttendance'){await result(db.from('pvol_attendance').delete().eq('id',b.id).eq('user_id',uid));return json({ok:true})}
 fail('Okänd åtgärd.');
 }catch(e){return json({error:e?.status?e.message:'Kunde inte slutföra åtgärden. Försök igen.'},e?.status||500)}});
