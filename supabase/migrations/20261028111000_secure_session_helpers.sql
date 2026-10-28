-- Privileged session access stays in a non-exposed schema, executable only by the backend.
create schema if not exists pvol_private;
revoke all on schema pvol_private from public,anon,authenticated;
grant usage on schema pvol_private to service_role;
create function pvol_private.session_active(sid text,uid uuid) returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from auth.sessions where id::text=sid and user_id=uid); $$;
create function pvol_private.revoke_sessions(u uuid) returns void language sql security definer set search_path='' as $$ delete from auth.sessions where user_id=u; $$;
revoke all on all functions in schema pvol_private from public,anon,authenticated;
grant execute on all functions in schema pvol_private to service_role;
create or replace function public.pvol_session_active(sid text,uid uuid) returns boolean language sql security invoker set search_path='' as $$ select pvol_private.session_active(sid,uid); $$;
create or replace function public.pvol_revoke_sessions(u uuid) returns void language sql security invoker set search_path='' as $$ select pvol_private.revoke_sessions(u); $$;
