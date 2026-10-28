create table public.pvol_chat(id uuid primary key default gen_random_uuid(),author uuid not null references public.pvol_members(user_id),body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now());
create index pvol_chat_created on public.pvol_chat(created_at desc);
create table public.pvol_phones(id uuid primary key default gen_random_uuid(),author uuid not null references public.pvol_members(user_id),name text not null check(length(name) between 1 and 120),category text not null check(length(category) between 1 and 80),phone text not null check(length(phone) between 1 and 40),description text not null default '',created_at timestamptz not null default now());
alter table public.pvol_chat enable row level security;
alter table public.pvol_phones enable row level security;
revoke all on public.pvol_chat,public.pvol_phones from anon,authenticated;
grant all on public.pvol_chat,public.pvol_phones to service_role;
alter table public.pvol_attendance drop constraint pvol_attendance_status_check;
alter table public.pvol_attendance add constraint pvol_attendance_status_check check(status in ('Jobbar','Sjuk','VAB','Ledig','Semester','Möte','Facklig','Fackligt jobb','Annat'));
