create table if not exists public.agenda_users (
  id text primary key, name text not null, email text not null unique,
  role text not null, initials text not null, tone text not null
);

create table if not exists public.agenda_availability (
  id bigint generated always as identity primary key,
  user_id text not null references public.agenda_users(id) on delete cascade,
  date date not null,
  start_minute smallint not null check (start_minute >= 420 and start_minute < 1080),
  end_minute smallint not null check (end_minute > start_minute and end_minute <= 1080),
  created_at timestamptz not null default now(),
  unique (user_id, date, start_minute, end_minute)
);

create table if not exists public.agenda_meetings (
  id bigint generated always as identity primary key,
  organizer_id text not null references public.agenda_users(id) on delete cascade,
  participant_id text not null references public.agenda_users(id) on delete cascade,
  date date not null,
  start_minute smallint not null check (start_minute >= 420 and start_minute < 1080),
  duration smallint not null check (duration between 15 and 180),
  created_at timestamptz not null default now()
);

create index if not exists agenda_availability_user_date_idx on public.agenda_availability(user_id,date);
create index if not exists agenda_meetings_organizer_date_idx on public.agenda_meetings(organizer_id,date);
create index if not exists agenda_meetings_participant_date_idx on public.agenda_meetings(participant_id,date);

alter table public.agenda_users enable row level security;
alter table public.agenda_availability enable row level security;
alter table public.agenda_meetings enable row level security;

grant select on public.agenda_users to anon, authenticated;
grant select, insert, delete on public.agenda_availability to anon, authenticated;
grant select, insert on public.agenda_meetings to anon, authenticated;
grant usage, select on sequence public.agenda_availability_id_seq to anon, authenticated;
grant usage, select on sequence public.agenda_meetings_id_seq to anon, authenticated;

create policy "agenda demo users are readable" on public.agenda_users for select to anon, authenticated using (true);
create policy "agenda demo availability is readable" on public.agenda_availability for select to anon, authenticated using (true);
create policy "agenda demo availability can be inserted" on public.agenda_availability for insert to anon, authenticated with check (true);
create policy "agenda demo availability can be deleted" on public.agenda_availability for delete to anon, authenticated using (true);
create policy "agenda demo meetings are readable" on public.agenda_meetings for select to anon, authenticated using (true);
create policy "agenda demo meetings can be inserted" on public.agenda_meetings for insert to anon, authenticated with check (true);

insert into public.agenda_users (id,name,email,role,initials,tone) values
('marina','Marina Alves','hunter@demo.com','Hunter','MA','coral'),
('bruno','Bruno Lima','closer@demo.com','Closer','BL','blue'),
('camila','Camila Rocha','gerente@demo.com','Gerente','CR','violet'),
('thiago','Thiago Brandão','thiago@demo.com','Hunter','TB','mint')
on conflict (id) do update set name=excluded.name,email=excluded.email,role=excluded.role,initials=excluded.initials,tone=excluded.tone;
