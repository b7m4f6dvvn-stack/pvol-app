"""Production proxy checks with a disposable account, supplied through stdin."""
import sys,json,urllib.request,urllib.error,http.cookiejar
cfg=json.loads(sys.stdin.readline());origin='https://pvol-forrad.vercel.app'
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(action,source=origin,**data):
    r=urllib.request.Request(origin+'/api',data=json.dumps(dict(action=action,**data)).encode(),headers={'Content-Type':'application/json','Origin':source})
    try:
        with client.open(r,timeout=45) as response:return response.status,json.load(response),response.headers
    except urllib.error.HTTPError as e:return e.code,json.load(e),e.headers
assert call('login',source='https://example.com',email=cfg['qa_email'],password=cfg['qa_password'])[0]==403
status,d,h=call('login',email=cfg['qa_email'],password=cfg['qa_password']);assert status==200,(status,d)
assert 'session' not in d
cookies=h.get_all('Set-Cookie');assert len(cookies)==2 and all('HttpOnly' in c and 'Secure' in c and 'SameSite=Lax' in c for c in cookies)
assert call('state')[0]==200
print('PASS production proxy, same-origin enforcement, HttpOnly cookies, authenticated state',flush=True)
# Force the proxy refresh flow by removing only its short-lived access cookie.
for cookie in list(jar):
    if cookie.name=='pvol_access':jar.clear(cookie.domain,cookie.path,cookie.name)
assert call('state')[0]==200
print('PASS refresh-token cookie session renewal',flush=True)
assert call('logout')[0]==200
assert call('state')[0]==401
assert not any(c.name.startswith('pvol_') for c in jar)
print('PASS production logout and cookie removal',flush=True)
