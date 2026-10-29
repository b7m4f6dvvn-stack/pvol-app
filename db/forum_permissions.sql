alter table public.pvol_members add column if not exists publish_forums text[] not null default '{}';
alter table public.pvol_invites add column if not exists publish_forums text[] not null default '{}';
alter table public.pvol_posts add column if not exists source_url text not null default '';
