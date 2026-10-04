alter table public.agenda_meetings
  add column if not exists meeting_type text not null default 'DIAG',
  add column if not exists status text not null default 'scheduled';

alter table public.agenda_meetings
  drop constraint if exists agenda_meetings_meeting_type_check,
  add constraint agenda_meetings_meeting_type_check
    check (meeting_type in ('AP', 'DIAG')),
  drop constraint if exists agenda_meetings_status_check,
  add constraint agenda_meetings_status_check
    check (status in ('scheduled', 'happened', 'no_show', 'rescheduling'));
