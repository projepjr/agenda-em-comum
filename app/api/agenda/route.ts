import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';

const demoUsers = [
  ['marina', 'Marina Alves', 'hunter@demo.com', 'Hunter', 'MA', 'coral'],
  ['bruno', 'Bruno Lima', 'closer@demo.com', 'Closer', 'BL', 'blue'],
  ['camila', 'Camila Rocha', 'gerente@demo.com', 'Gerente', 'CR', 'violet'],
  ['thiago', 'Thiago Brandão', 'thiago@demo.com', 'Hunter', 'TB', 'mint'],
] as const;

async function setup() {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, initials TEXT NOT NULL, tone TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS availability (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, start_minute INTEGER NOT NULL, end_minute INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, organizer_id TEXT NOT NULL, participant_id TEXT NOT NULL, date TEXT NOT NULL, start_minute INTEGER NOT NULL, duration INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS availability_unique ON availability(user_id,date,start_minute,end_minute);
  `);
  const insert = env.DB.prepare('INSERT OR IGNORE INTO users (id,name,email,role,initials,tone) VALUES (?,?,?,?,?,?)');
  await env.DB.batch(demoUsers.map((user) => insert.bind(...user)));
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM availability').first<{ total: number }>();
  if (!count?.total) {
    const seed = env.DB.prepare('INSERT INTO availability (user_id,date,start_minute,end_minute) VALUES (?,?,?,?)');
    await env.DB.batch([
      seed.bind('marina','2026-10-05',480,660), seed.bind('marina','2026-10-05',810,990), seed.bind('marina','2026-10-06',540,720),
      seed.bind('marina','2026-10-07',450,600), seed.bind('marina','2026-10-07',840,1020), seed.bind('marina','2026-10-08',630,780), seed.bind('marina','2026-10-09',510,720),
      seed.bind('bruno','2026-10-05',540,720), seed.bind('bruno','2026-10-05',840,1020), seed.bind('bruno','2026-10-06',600,780),
      seed.bind('bruno','2026-10-07',480,660), seed.bind('bruno','2026-10-07',900,1080), seed.bind('bruno','2026-10-08',600,750), seed.bind('bruno','2026-10-09',540,690),
      seed.bind('camila','2026-10-05',450,600), seed.bind('camila','2026-10-05',810,960), seed.bind('camila','2026-10-06',540,690),
      seed.bind('camila','2026-10-07',480,630), seed.bind('camila','2026-10-08',660,840), seed.bind('camila','2026-10-09',480,660),
    ]);
  }
}

function session(request: NextRequest) { return request.cookies.get('agenda_demo_user')?.value; }

const pad = (value: number) => String(value).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const addMonths = (date: Date, amount: number) => { const next = new Date(date); next.setMonth(next.getMonth() + amount); return next; };

function recurrenceDates(baseValue: string, recurrence: string) {
  const base = new Date(`${baseValue}T12:00:00`);
  if (Number.isNaN(base.getTime())) return [];
  if (recurrence === 'daily') {
    const limit = addMonths(base, 12), dates: string[] = [];
    for (let cursor = new Date(base); cursor < limit; cursor = addDays(cursor, 1)) if (cursor.getDay() >= 1 && cursor.getDay() <= 5) dates.push(toIso(cursor));
    return dates;
  }
  if (recurrence === 'weekly') return Array.from({ length: 52 }, (_, index) => toIso(addDays(base, index * 7)));
  if (recurrence === 'monthly') {
    const weekday = base.getDay(), ordinal = Math.floor((base.getDate() - 1) / 7);
    return Array.from({ length: 12 }, (_, index) => {
      const month = new Date(base.getFullYear(), base.getMonth() + index, 1, 12);
      const offset = (weekday - month.getDay() + 7) % 7;
      const candidate = new Date(month.getFullYear(), month.getMonth(), 1 + offset + ordinal * 7, 12);
      if (candidate.getMonth() !== month.getMonth()) candidate.setDate(candidate.getDate() - 7);
      return toIso(candidate);
    });
  }
  return [toIso(base)];
}

export async function GET(request: NextRequest) {
  await setup();
  const userId = session(request);
  const users = await env.DB.prepare('SELECT * FROM users ORDER BY name').all();
  const availability = await env.DB.prepare('SELECT id, user_id as userId, date, start_minute as startMinute, end_minute as endMinute FROM availability').all();
  const meetings = userId ? await env.DB.prepare('SELECT id, organizer_id as organizerId, participant_id as participantId, date, start_minute as startMinute, duration FROM meetings WHERE organizer_id=? OR participant_id=? ORDER BY date,start_minute').bind(userId,userId).all() : { results: [] };
  return NextResponse.json({ userId, users: users.results, availability: availability.results, meetings: meetings.results });
}

export async function POST(request: NextRequest) {
  await setup();
  const body = await request.json() as Record<string, unknown>;
  if (body.action === 'login') {
    const user = demoUsers.find((entry) => entry[2] === body.email);
    if (!user || body.password !== 'demo123') return NextResponse.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 });
    const response = NextResponse.json({ ok: true, userId: user[0] });
    response.cookies.set('agenda_demo_user', user[0], { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    return response;
  }
  if (body.action === 'logout') {
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('agenda_demo_user');
    return response;
  }
  const userId = session(request);
  if (!userId) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  if (body.action === 'addAvailability') {
    const dates = recurrenceDates(String(body.date), String(body.recurrence || 'once'));
    const start = Number(body.startMinute), end = Number(body.endMinute);
    if (!dates.length || start < 420 || end > 1080 || end <= start) return NextResponse.json({ error: 'Use um intervalo entre 07:00 e 18:00.' }, { status: 400 });
    const insert = env.DB.prepare('INSERT OR IGNORE INTO availability (user_id,date,start_minute,end_minute) VALUES (?,?,?,?)');
    for (let offset = 0; offset < dates.length; offset += 75) await env.DB.batch(dates.slice(offset, offset + 75).map((date) => insert.bind(userId, date, start, end)));
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'deleteAvailability') {
    await env.DB.prepare('DELETE FROM availability WHERE id=? AND user_id=?').bind(Number(body.id), userId).run();
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'book') {
    const participantIds = Array.isArray(body.participantIds) ? body.participantIds.map(String) : [];
    const date = String(body.date), start = Number(body.startMinute), duration = Number(body.duration);
    if (!participantIds.length) return NextResponse.json({ error: 'Selecione pelo menos uma pessoa.' }, { status: 400 });
    const insert = env.DB.prepare('INSERT INTO meetings (organizer_id,participant_id,date,start_minute,duration) VALUES (?,?,?,?,?)');
    await env.DB.batch(participantIds.map((participantId) => insert.bind(userId, participantId, date, start, duration)));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
}
