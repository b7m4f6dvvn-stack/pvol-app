alter table public.pvol_members add column if not exists birthday_mmdd text check(birthday_mmdd is null or birthday_mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
