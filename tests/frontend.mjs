import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},showModal(){this.open=true},close(){this.open=false},focus(){},setSelectionRange(){}});return elements.get(id)}
const context=vm.createContext({document:{getElementById:element,addEventListener(){},hidden:false},location:{hash:'',pathname:'/',origin:'https://pvol-forrad.vercel.app'},history:{replaceState(){}},navigator:{},URL,URLSearchParams,Date,Intl,console,setInterval(){},setTimeout(){},window:{scrollTo(){}},fetch:async()=>({ok:false,status:401,json:async()=>({error:'Logga in'})})});
await vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
const fixture={me:{user_id:'u1',display_name:'QA',role:'member'},posts:[{id:'p1',author:'u1',body:'<script>alert(1)</script>',category:'Inlägg',created_at:'2026-10-28T10:00:00Z'}],comments:[{id:'c1',post_id:'p1',author:'u1',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-28T10:01:00Z'}],events:[],instructions:[],members:[{user_id:'u1',display_name:'QA',role:'member',active:true}],meetings:[],attendance:[],invites:[]};
context.fixture=fixture;vm.runInContext('state=fixture;render()',context);
assert(element('root').innerHTML.includes('&lt;script&gt;'));
assert(!element('root').innerHTML.includes('<script>'));
assert(element('root').innerHTML.includes('&lt;img'));
assert(element('nav').innerHTML.includes('Mitt konto'));
for(const view of ['calendar','attendance','instructions','account','chat','phones','job']){
 vm.runInContext(`tab='${view}';render()`,context);assert(element('root').innerHTML.length>150);
}
assert(!element('root').innerHTML.includes('Skapa inbjudan'));
fixture.me.role='owner';vm.runInContext("tab='account';render()",context);assert(element('root').innerHTML.includes('Skapa inbjudan'));assert(element('root').innerHTML.includes('Huvudadmin'));
vm.runInContext('postForm()',context);assert(element('dialog').open);assert(element('modal').innerHTML.includes('Bifoga en bild'));
assert.equal(vm.runInContext("stockholmTime('2026-11-01T16:00')",context),'2026-11-01T15:00:00.000Z');
assert.equal(vm.runInContext("stockholmTime('2026-07-01T16:00')",context),'2026-07-01T14:00:00.000Z');
assert.throws(()=>vm.runInContext("stockholmTime('2026-03-29T02:30')",context));
assert(!fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/on(click|submit)=/));
assert(!fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').includes('localStorage'));
console.log('PASS frontend rendering across all views, role menus, escaped content, modal, Stockholm timezone and DST');

fixture.phones=[{id:'n1',author:'u1',name:'Truckar',category:'Truckar',phone:'+46 (31) 123-45',description:'<script>test</script>'}];vm.runInContext('phones()',context);assert(element('root').innerHTML.includes('href="tel:+463112345"'));assert(!element('root').innerHTML.includes('<script>'));
fixture.chat=[{id:'m1',author:'u1',body:'<img src=x>',created_at:'2026-10-28T10:00:00Z'}];vm.runInContext('chat()',context);assert(element('root').innerHTML.includes('&lt;img'));
vm.runInContext("category='Truckar';job();instructionForm()",context);assert(element('root').innerHTML.includes('Arbetsinstruktioner'));assert(element('root').innerHTML.includes('Annat viktigt'));assert(element('modal').innerHTML.includes('<option selected>Truckar</option>'));
console.log('PASS chat escaping, telephone links and job sections with admin editing');

vm.runInContext("invite='qa';inviteInfo={name:'Invite label',recovery:false};login()",context);assert(element('root').innerHTML.includes('autocomplete="username"'));assert(element('root').innerHTML.includes('autocomplete="new-password"'));assert(element('root').innerHTML.includes('name="name"'));vm.runInContext("inviteInfo={recovery:true};login()",context);assert(!element('root').innerHTML.includes('name="name"'));vm.runInContext('account()',context);assert(element('root').innerHTML.includes('data-form="profile"'));console.log('PASS first-use email, own password and display name, recovery and profile form');

fixture.attendance=[{user_id:'u1',status:'Sjuk',start_date:'2026-10-28',end_date:'2026-10-28',start_time:'09:00',end_time:'11:00',created_at:'2026-10-28T07:00:00Z'}];vm.runInContext('state=fixture',context);assert.equal(vm.runInContext("attendanceStatus('u1','2026-10-28T10:00').status",context),'Sjuk');assert.equal(vm.runInContext("attendanceStatus('u1','2026-10-28T12:00')",context),undefined);vm.runInContext('attendance()',context);assert(element('root').innerHTML.indexOf('name="status"')<element('root').innerHTML.indexOf('name="start"'));assert(element('root').innerHTML.includes('Alla medlemmar just nu'));console.log('PASS attendance reason first and timed status boundaries');

vm.runInContext("tab='home';render()",context);assert(element('nav').innerHTML.includes('Telefonlista'));assert(!element('nav').innerHTML.includes('data-tab="instructions"'));fixture.instructions=[{id:'i1',category:'Truckar',title:'Truck instruction',body:'Truck content',updated_at:'2026-10-28T10:00:00Z'},{id:'i2',category:'Plock',title:'Plock instruction',body:'Plock content',updated_at:'2026-10-28T10:00:00Z'}];vm.runInContext("category='Truckar';instructions()",context);assert(element('root').innerHTML.includes('Truck instruction'));assert(!element('root').innerHTML.includes('Plock instruction'));vm.runInContext('job()',context);assert(element('root').innerHTML.includes('data-do="goJobInstructions"'));console.log('PASS per-job instruction shortcut, category scoping and telephone navigation');
vm.runInContext("calendarMonth='2026-12';almanacs.set(calendarMonth,{days:[{date:'2026-12-24',names:['Eva'],red:false}]});state.members[0].birthday_mmdd='12-24';calendar()",context);assert(element('root').innerHTML.includes('december 2026'));assert(element('root').innerHTML.includes('Juldagen'));assert(element('root').innerHTML.includes('Eva'));assert(element('root').innerHTML.includes('🎂 QA'));assert.equal(vm.runInContext("isoWeek('2027-01-01')",context),53);assert.equal(vm.runInContext("holidays(2026)['2026-04-05'].name",context),'Påskdagen');assert.equal(vm.runInContext("holidays(2026)['2026-06-20'].name",context),'Midsommardagen');console.log('PASS month grid, ISO weeks, holidays, name days and birthdays');
