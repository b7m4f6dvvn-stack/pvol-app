alter table public.pvol_members add column if not exists leadership_publisher boolean not null default false;
alter table public.pvol_invites add column if not exists leadership_publisher boolean not null default false;
