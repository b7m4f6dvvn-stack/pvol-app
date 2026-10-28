import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},showModal(){this.open=true},close(){this.open=false},focus(){},setSelectionRange(){}});return elements.get(id)}
const context=vm.createContext({document:{getElementById:element,addEventListener(){},hidden:false},location:{hash:'',pathname:'/',origin:'https://pvol-forrad.vercel.app'},history:{replaceState(){}},navigator:{},URL,URLSearchParams,Date,Intl,console,setTimeout(){},window:{scrollTo(){}},fetch:async()=>({ok:false,status:401,json:async()=>({error:'Logga in'})})});
await vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
const fixture={me:{user_id:'u1',display_name:'QA',role:'member'},posts:[{id:'p1',author:'u1',body:'<script>alert(1)</script>',category:'Inlägg',created_at:'2026-10-28T10:00:00Z'}],comments:[{id:'c1',post_id:'p1',author:'u1',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-28T10:01:00Z'}],events:[],instructions:[],members:[{user_id:'u1',display_name:'QA',role:'member',active:true}],meetings:[],attendance:[],invites:[]};
context.fixture=fixture;vm.runInContext('state=fixture;render()',context);
assert(element('root').innerHTML.includes('&lt;script&gt;'));
assert(!element('root').innerHTML.includes('<script>'));
assert(element('root').innerHTML.includes('&lt;img'));
assert(element('nav').innerHTML.includes('Mitt konto'));
for(const view of ['calendar','attendance','instructions','account']){
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
