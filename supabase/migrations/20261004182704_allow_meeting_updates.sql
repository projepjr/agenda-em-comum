grant update on table public.agenda_meetings to anon, authenticated;

drop policy if exists "agenda demo meetings can be updated" on public.agenda_meetings;
create policy "agenda demo meetings can be updated"
  on public.agenda_meetings
  for update
  to anon, authenticated
  using (true)
  with check (true);
