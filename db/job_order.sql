create table public.pvol_settings(id boolean primary key default true check(id),job_order text[] not null check(cardinality(job_order)=10),updated_by uuid references public.pvol_members(user_id),updated_at timestamptz not null default now());
alter table public.pvol_settings enable row level security;
revoke all on public.pvol_settings from anon,authenticated;
grant all on public.pvol_settings to service_role;
insert into public.pvol_settings(id,job_order) values(true,array['Övrigt','Truckar','Plock','Inlägg','Moppe','Utkör','Avrop','Luckan','Brist','Däck']);
