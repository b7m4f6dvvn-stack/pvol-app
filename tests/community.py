import json,sys,urllib.request,urllib.error,secrets
cfg=json.loads(sys.stdin.readline());base='https://usximvurnararrwsnbit.supabase.co/functions/v1/pvol-api'
def call(action,jwt='',**d):
 req=urllib.request.Request(base,data=json.dumps(dict(action=action,**d)).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+jwt})
 try:
  with urllib.request.urlopen(req,timeout=45) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def ok(action,jwt='',**d):
 s,v=call(action,jwt,**d);assert s==200,(action,s,v);return v
users=[]
for t in cfg['tokens']:
 d=ok('accept',token=t,email='pvol-community-qa-'+secrets.token_hex(8)+'@example.com',password='Qa9-'+secrets.token_hex(20))['session'];users.append((d['access_token'],d['user']['id']))
a,aid=users[0];b,bid=users[1]
assert call('chat',body='No access')[0]==401
ok('chat',a,body='QA question');s=ok('state',b);m=next(m for m in s['chat'] if m['author']==aid);assert call('deleteChat',b,id=m['id'])[0]==403
ok('phone',a,name='QA truck',category='Truckar',phone='+46 (31) 123-45',description='QA only');p=next(p for p in ok('state',b)['phones'] if p['author']==aid)
ok('phone',b,id=p['id'],name='QA changed',category='Truckar',phone='031-12345',description='QA edit');assert call('deletePhone',b,id=p['id'])[0]==403
assert call('phone',a,name='Bad',category='Test',phone='javascript:123',description='')[0]==400
ok('attendance',a,start='2026-10-28',end='2026-10-28',status='Semester',note='PRIVATE-QA')
row=next(r for r in ok('state',b)['attendance'] if r['user_id']==aid);assert row['status']=='Semester' and row['note']==''
assert next(r for r in ok('state',a)['attendance'] if r['id']==row['id'])['note']=='PRIVATE-QA'
assert call('instruction',b,title='Forbidden',category='Truckar',body='x')[0]==403
ok('deleteAttendance',a,id=row['id']);ok('deletePhone',a,id=p['id']);ok('deleteChat',a,id=m['id'])
for token,_ in users:ok('logout',token)
print('PASS live chat, shared phone editing, ownership checks, status sharing, private notes, admin protection and logout')
print(json.dumps({'cleanup_users':[u for _,u in users]}))
