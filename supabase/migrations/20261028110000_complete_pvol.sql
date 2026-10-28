-- All application access is verified by pvol-api; no direct client table access.
alter table public.pvol_members add column if not exists active boolean not null default true;
alter table public.pvol_invites add column if not exists display_name text not null default '';
alter table public.pvol_invites add column if not exists target_user uuid references auth.users(id);
create table public.pvol_posts(id uuid primary key default gen_random_uuid(),author uuid not null references public.pvol_members(user_id),body text not null check(length(body) between 1 and 5000),category text not null default 'Inlägg',image text,created_at timestamptz not null default now());
create table public.pvol_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.pvol_posts(id) on delete cascade,author uuid not null references public.pvol_members(user_id),body text not null check(length(body) between 1 and 1000),created_at timestamptz not null default now());
create table public.pvol_events(id uuid primary key default gen_random_uuid(),title text not null,starts_at timestamptz not null,location text not null default '',description text not null default '',cancelled boolean not null default false,author uuid not null references public.pvol_members(user_id));
create table public.pvol_instructions(id uuid primary key default gen_random_uuid(),title text not null,category text not null,body text not null,author uuid not null references public.pvol_members(user_id),updated_at timestamptz not null default now());
create table public.pvol_rate_limits(key text primary key,n integer not null,expires_at timestamptz not null);
alter table public.pvol_posts enable row level security;
alter table public.pvol_comments enable row level security;
alter table public.pvol_events enable row level security;
alter table public.pvol_instructions enable row level security;
alter table public.pvol_rate_limits enable row level security;
revoke all on public.pvol_members,public.pvol_invites,public.pvol_posts,public.pvol_comments,public.pvol_events,public.pvol_instructions,public.pvol_rate_limits,public.pvol_attendance,public.pvol_meeting_changes from anon,authenticated;
create index on public.pvol_posts(created_at desc);
create index on public.pvol_comments(post_id);
create index on public.pvol_events(starts_at);
create or replace function public.pvol_throttle(k text) returns integer language sql security invoker set search_path='' as $$
 insert into public.pvol_rate_limits(key,n,expires_at) values(k,1,now()+interval '15 minutes') on conflict(key) do update set n=public.pvol_rate_limits.n+1 returning n;
$$;
revoke all on function public.pvol_throttle(text) from public,anon,authenticated;
grant execute on function public.pvol_throttle(text) to service_role;
create or replace function public.pvol_accept(h text,u uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.pvol_invites;
begin
 select * into v from public.pvol_invites where token_hash=h and used_at is null and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'Invalid invite'; end if;
 if v.target_user is null then
 insert into public.pvol_members(user_id,display_name,role) values(u,v.display_name,'member');
 elsif v.target_user<>u then raise exception 'Wrong user'; end if;
 update public.pvol_invites set used_by=u,used_at=now() where id=v.id;
 return u;
end;$$;
revoke all on function public.pvol_accept(text,uuid) from public,anon,authenticated;
grant execute on function public.pvol_accept(text,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('pvol-images','pvol-images',false,5000000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create or replace function public.pvol_session_active(sid text,uid uuid) returns boolean language sql security invoker set search_path='' as $$ select exists(select 1 from auth.sessions where id::text=sid and user_id=uid); $$;
revoke all on function public.pvol_session_active(text,uuid) from public,anon,authenticated;
grant execute on function public.pvol_session_active(text,uuid) to service_role;
create or replace function public.pvol_revoke_sessions(u uuid) returns void language sql security invoker set search_path='' as $$ delete from auth.sessions where user_id=u; $$;
revoke all on function public.pvol_revoke_sessions(uuid) from public,anon,authenticated;
grant execute on function public.pvol_revoke_sessions(uuid) to service_role;
