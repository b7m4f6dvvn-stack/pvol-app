alter table public.pvol_attendance add column if not exists start_time time;
alter table public.pvol_attendance add column if not exists end_time time;
alter table public.pvol_attendance add constraint pvol_attendance_time_order check(start_date < end_date or start_time is null or end_time is null or start_time < end_time);
