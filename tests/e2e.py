"""Live integration test. JSON on stdin supplies token and optional endpoint.
Never prints authentication tokens or passwords. Uses disposable test data only.
"""
import json,sys,urllib.request,urllib.error,secrets,concurrent.futures
cfg=json.loads(sys.stdin.readline()); BASE=cfg.get('endpoint','https://usximvurnararrwsnbit.supabase.co/functions/v1/pvol-api')
password='Qa-'+secrets.token_hex(16)+'9';email='pvol-qa-'+secrets.token_hex(6)+'@example.com';jwt=''
def call(action,token=None,**data):
    body=json.dumps(dict(action=action,**data)).encode()
    req=urllib.request.Request(BASE,data=body,headers={'Content-Type':'application/json','Authorization':'Bearer '+(token if token is not None else jwt)})
    try:
        with urllib.request.urlopen(req,timeout=45) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def ok(action,**data):
    status,out=call(action,**data)
    assert status==200,(action,status,out)
    return out
def check(label,fn):
    fn();print('PASS '+label,flush=True)
assert call('state')[0]==401
print('PASS unauthenticated denied',flush=True)
# token is auth header argument; invitation token belongs in JSON.
def public(action,**data):
    body=json.dumps(dict(action=action,**data)).encode();req=urllib.request.Request(BASE,data=body,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=45) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
assert public('inviteInfo',token=cfg['token'])[0]==200
status,out=public('accept',token=cfg['token'],email=email,password=password);assert status==200,(status,out)
jwt=out['session']['access_token'];uid=out['session']['user']['id'];s=ok('state');assert s['me']['role']=='member'
assert public('accept',token=cfg['token'],email=email,password=password)[0]==410
assert call('invite',name='Forbidden')[0]==403
assert call('event',title='Forbidden')[0]==403
assert call('member',id=uid,role='owner',active=True,name='QA')[0]==403
print('PASS invite acceptance, one-time use, member role boundaries',flush=True)
ok('post',body='<script>alert(1)</script> QA post',category='Inlägg')
s=ok('state');post=next(x for x in s['posts'] if x['author']==uid)
ok('comment',post=post['id'],body='QA comment')
ok('attendance',start='2026-10-28',end='2026-10-29',status='Jobbar',note='QA private')
s=ok('state');assert any(c['post_id']==post['id'] for c in s['comments']);assert len([a for a in s['attendance'] if a['user_id']==uid])==1
print('PASS posts, comments, own attendance',flush=True)
# Wait for operator to grant owner to this disposable test identity only.
print(json.dumps({'qa_user_id':uid}),flush=True)
assert sys.stdin.readline().strip()=='continue'
s=ok('state');assert s['me']['role']=='owner'
ok('event',title='QA activity',starts='2026-11-01T15:00:00Z',location='QA room',body='QA description')
ok('instruction',title='QA instruction',category='Truckar',body='QA steps')
ok('meeting',date='2026-12-28',type='morgon',location='QA matsal',cancelled=True,reason='QA')
d=ok('invite',name='QA colleague');token=d['token']
assert public('inviteInfo',token=token)[0]==200
s=ok('state');iv=next(i for i in s['invites'] if i['display_name']=='QA colleague');ok('revokeInvite',id=iv['id']);assert public('inviteInfo',token=token)[0]==410
print('PASS calendar, instructions, meeting overrides, invite revocation',flush=True)
# Second identity: verify privacy and IDOR.
d=ok('invite',name='QA second');token=d['token'];password2='Qa-'+secrets.token_hex(16)+'1';email2='pvol-qa-'+secrets.token_hex(6)+'@example.com'
status,out=public('accept',token=token,email=email2,password=password2);assert status==200
jwt2=out['session']['access_token'];uid2=out['session']['user']['id']
status,s2=call('state',token=jwt2);assert status==200 and all(a['note']=='' for a in s2['attendance'] if a['user_id']!=uid2)
assert call('deletePost',token=jwt2,id=post['id'])[0]==403
assert call('post',token=jwt2,id=post['id'],body='Hijack',category='AW')[0]==403
assert call('instruction',token=jwt2,title='Nope')[0]==403
ok('member',id=uid2,role='admin',active=True,name='QA second');assert call('state',token=jwt2)[1]['me']['role']=='admin'
assert call('member',token=jwt2,id=uid,role='member',active=True,name='Hijack')[0]==403
ok('member',id=uid2,role='member',active=False,name='QA second');assert call('state',token=jwt2)[0] in (401,403)
print('PASS privacy, content ownership, admin boundaries, immediate suspension',flush=True)
# Password recovery only affects disposable second user.
ok('member',id=uid2,role='member',active=True,name='QA second')
d=ok('invite',name='QA recovery',target=uid2);newpass='Qa-'+secrets.token_hex(16)+'2'
assert public('accept',token=d['token'],password=newpass)[0]==200
assert public('accept',token=d['token'],password=newpass)[0]==410
assert public('login',email=email2,password=password2)[0]==401
assert public('login',email=email2,password=newpass)[0]==200
print('PASS password recovery, one-time recovery, old password denied',flush=True)
# Image upload and private signed retrieval.
import base64
png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1cAAAAASUVORK5CYII='
ok('post',body='QA image',category='AW',image=png)
s=ok('state');photo=next(p for p in s['posts'] if p['author']==uid and p['image'])
assert photo['imageURL']
with urllib.request.urlopen(photo['imageURL'],timeout=45) as r:assert r.status==200 and r.headers.get('Content-Type').startswith('image/')
assert call('post',body='Bad image',category='AW',image=base64.b64encode(b'not an image').decode())[0]==400
print('PASS image upload, signed image retrieval, invalid image denied',flush=True)
# Delete disposable data through UI-equivalent endpoints.
for c in s['comments']:
    if c['author']==uid:ok('deleteComment',id=c['id'])
for p in s['posts']:
    if p['author']==uid:ok('deletePost',id=p['id'])
for e in s['events']:
    if e['author']==uid:ok('deleteEvent',id=e['id'])
for i in s['instructions']:
    if i['author']==uid:ok('deleteInstruction',id=i['id'])
for a in s['attendance']:
 if a['user_id']==uid:ok('deleteAttendance',id=a['id'])
ok('logout');assert call('state')[0]==401
print('PASS delete flows and logout session revocation',flush=True)
print(json.dumps({'cleanup_users':[uid,uid2]}),flush=True)
