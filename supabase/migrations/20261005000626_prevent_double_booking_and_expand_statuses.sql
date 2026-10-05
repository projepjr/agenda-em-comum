alter table public.agenda_meetings
  drop constraint if exists agenda_meetings_status_check,
  add constraint agenda_meetings_status_check
    check (status in (
      'scheduled',
      'happened',
      'no_show',
      'rescheduling',
      'interest_future',
      'discarded'
    ));

create or replace function public.agenda_book_meeting(
  p_organizer_id text,
  p_participant_ids text[],
  p_date date,
  p_start_minute integer,
  p_duration integer,
  p_title text,
  p_meeting_type text,
  p_group_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  person_id text;
  involved_people text[];
begin
  if p_organizer_id is null
    or coalesce(array_length(p_participant_ids, 1), 0) = 0
    or p_start_minute < 420
    or p_duration < 15
    or p_start_minute + p_duration > 1080
    or p_meeting_type not in ('AP', 'DIAG')
    or length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Dados de reunião inválidos.';
  end if;

  select array_agg(distinct value order by value)
    into involved_people
  from unnest(array_append(p_participant_ids, p_organizer_id)) as value;

  for person_id in select unnest(involved_people) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(person_id, 0));
  end loop;

  if exists (
    select 1
    from public.agenda_meetings meeting
    where meeting.date = p_date
      and meeting.status <> 'discarded'
      and meeting.start_minute < p_start_minute + p_duration
      and meeting.start_minute + meeting.duration > p_start_minute
      and (
        meeting.organizer_id = any(involved_people)
        or meeting.participant_id = any(involved_people)
      )
  ) then
    raise exception 'Horário indisponível para uma das pessoas.';
  end if;

  insert into public.agenda_meetings (
    organizer_id,
    participant_id,
    date,
    start_minute,
    duration,
    title,
    meeting_type,
    status,
    meeting_group_id
  )
  select
    p_organizer_id,
    participant_id,
    p_date,
    p_start_minute,
    p_duration,
    trim(p_title),
    p_meeting_type,
    'scheduled',
    p_group_id
  from unnest(p_participant_ids) as participant_id;

  return p_group_id;
end;
$$;

revoke all on function public.agenda_book_meeting(text, text[], date, integer, integer, text, text, uuid) from public;
grant execute on function public.agenda_book_meeting(text, text[], date, integer, integer, text, text, uuid) to anon, authenticated;
