alter table public.agenda_meetings
  add column if not exists title text not null default 'Reunião',
  add column if not exists meeting_group_id uuid;

update public.agenda_meetings
set meeting_group_id = gen_random_uuid()
where meeting_group_id is null;

alter table public.agenda_meetings
  alter column meeting_group_id set not null;

create index if not exists agenda_meetings_group_idx
  on public.agenda_meetings(meeting_group_id);

grant update on public.agenda_availability to anon, authenticated;
grant delete on public.agenda_meetings to anon, authenticated;

create policy "agenda demo availability can be updated"
on public.agenda_availability
for update to anon, authenticated
using (true)
with check (true);

create policy "agenda demo meetings can be deleted"
on public.agenda_meetings
for delete to anon, authenticated
using (true);
