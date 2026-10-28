create table public.pvol_trucks(id uuid primary key default gen_random_uuid(),truck_number text not null unique check(length(truck_number) between 1 and 30),status text not null default 'I drift' check(status in ('I drift','Felanmäld','På reparation')),note text not null default '' check(length(note)<=1000),updated_by uuid not null references public.pvol_members(user_id),updated_at timestamptz not null default now());
alter table public.pvol_trucks enable row level security;
revoke all on public.pvol_trucks from anon,authenticated;
grant all on public.pvol_trucks to service_role;
