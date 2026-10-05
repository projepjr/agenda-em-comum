alter table public.agenda_availability
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_type text not null default 'once';

alter table public.agenda_availability
  drop constraint if exists agenda_availability_recurrence_type_check;

alter table public.agenda_availability
  add constraint agenda_availability_recurrence_type_check
  check (recurrence_type in ('once', 'daily', 'weekly'));

create index if not exists agenda_availability_recurrence_group_idx
  on public.agenda_availability (recurrence_group_id, date)
  where recurrence_group_id is not null;

create or replace function public.agenda_add_availability(
  p_user_id text,
  p_dates date[],
  p_start_minute smallint,
  p_end_minute smallint,
  p_recurrence_type text,
  p_group_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if p_user_id is null
    or coalesce(array_length(p_dates, 1), 0) = 0
    or p_start_minute < 420
    or p_end_minute > 1080
    or p_end_minute <= p_start_minute
    or p_recurrence_type not in ('once', 'daily', 'weekly') then
    raise exception 'Disponibilidade inválida';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('agenda_availability:' || p_user_id, 0));

  if exists (
    select 1
    from public.agenda_availability existing
    where existing.user_id = p_user_id
      and existing.date = any(p_dates)
      and existing.start_minute < p_end_minute
      and existing.end_minute > p_start_minute
  ) then
    raise exception 'Horário indisponível: já existe ou conflita com outro intervalo';
  end if;

  v_group_id := case
    when p_recurrence_type = 'once' then null
    else coalesce(p_group_id, gen_random_uuid())
  end;

  insert into public.agenda_availability (
    user_id,
    date,
    start_minute,
    end_minute,
    recurrence_group_id,
    recurrence_type
  )
  select
    p_user_id,
    occurrence_date,
    p_start_minute,
    p_end_minute,
    v_group_id,
    p_recurrence_type
  from unnest(p_dates) as occurrence_date;
end;
$$;

create or replace function public.agenda_update_availability(
  p_id bigint,
  p_user_id text,
  p_date date,
  p_start_minute smallint,
  p_end_minute smallint
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_id is null
    or p_user_id is null
    or p_date is null
    or p_start_minute < 420
    or p_end_minute > 1080
    or p_end_minute <= p_start_minute then
    raise exception 'Disponibilidade inválida';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('agenda_availability:' || p_user_id, 0));

  if not exists (
    select 1 from public.agenda_availability
    where id = p_id and user_id = p_user_id
  ) then
    raise exception 'Horário não encontrado';
  end if;

  if exists (
    select 1
    from public.agenda_availability existing
    where existing.user_id = p_user_id
      and existing.date = p_date
      and existing.id <> p_id
      and existing.start_minute < p_end_minute
      and existing.end_minute > p_start_minute
  ) then
    raise exception 'Horário indisponível: já existe ou conflita com outro intervalo';
  end if;

  update public.agenda_availability
  set date = p_date,
      start_minute = p_start_minute,
      end_minute = p_end_minute
  where id = p_id and user_id = p_user_id;
end;
$$;

revoke all on function public.agenda_add_availability(text, date[], smallint, smallint, text, uuid) from public;
revoke all on function public.agenda_update_availability(bigint, text, date, smallint, smallint) from public;
grant execute on function public.agenda_add_availability(text, date[], smallint, smallint, text, uuid) to anon, authenticated;
grant execute on function public.agenda_update_availability(bigint, text, date, smallint, smallint) to anon, authenticated;
