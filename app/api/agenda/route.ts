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
    const dates = Array.isArray(body.dates) ? body.dates : [];
    const start = Number(body.startMinute), end = Number(body.endMinute);
    if (!dates.length || start < 420 || end > 1080 || end <= start) return NextResponse.json({ error: 'Use um intervalo entre 07:00 e 18:00.' }, { status: 400 });
    const insert = env.DB.prepare('INSERT INTO availability (user_id,date,start_minute,end_minute) VALUES (?,?,?,?)');
    await env.DB.batch(dates.map((date) => insert.bind(userId, date, start, end)));
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'deleteAvailability') {
    await env.DB.prepare('DELETE FROM availability WHERE id=? AND user_id=?').bind(Number(body.id), userId).run();
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'book') {
    const participantId = String(body.participantId), date = String(body.date), start = Number(body.startMinute), duration = Number(body.duration);
    await env.DB.prepare('INSERT INTO meetings (organizer_id,participant_id,date,start_minute,duration) VALUES (?,?,?,?,?)').bind(userId, participantId, date, start, duration).run();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
}
