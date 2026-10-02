'use client';

import { useEffect, useMemo, useState } from 'react';

type User = { id:string; name:string; email:string; role:string; initials:string; tone:string };
type Avail = { id:number; userId:string; date:string; startMinute:number; endMinute:number };
type Meeting = { id:number; organizerId:string; participantId:string; date:string; startMinute:number; duration:number };
type Data = { userId?:string; users:User[]; availability:Avail[]; meetings:Meeting[] };
type View = 'agenda'|'find'|'meetings';
const demos = [
  { name:'Marina Alves', role:'Hunter', email:'hunter@demo.com', initials:'MA', tone:'coral' },
  { name:'Bruno Lima', role:'Closer', email:'closer@demo.com', initials:'BL', tone:'blue' },
  { name:'Camila Rocha', role:'Gerente', email:'gerente@demo.com', initials:'CR', tone:'violet' },
];
const days=['SEG','TER','QUA','QUI','SEX'];
const pad=(n:number)=>String(n).padStart(2,'0');
const hm=(m:number)=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=(d:Date)=>{const x=new Date(d);const dow=x.getDay()||7;x.setDate(x.getDate()-dow+1);x.setHours(12,0,0,0);return x};
const dateLabel=(d:Date)=>new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(d).replace('.','');

export default function Home(){
  const [email,setEmail]=useState('hunter@demo.com'),[password,setPassword]=useState('demo123');
  const [data,setData]=useState<Data>({users:[],availability:[],meetings:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [view,setView]=useState<View>('agenda'),[week,setWeek]=useState(new Date('2026-10-05T12:00:00'));
  const [modal,setModal]=useState(false),[date,setDate]=useState('2026-10-05'),[start,setStart]=useState('08:00'),[end,setEnd]=useState('10:00'),[repeat,setRepeat]=useState('once');
  const [person,setPerson]=useState('bruno'),[duration,setDuration]=useState(30),[custom,setCustom]=useState(''),[toast,setToast]=useState('');
  const refresh=async()=>{const r=await fetch('/api/agenda');const j=await r.json();setData(j);setLoading(false)};
  useEffect(()=>{void fetch('/api/agenda').then(r=>r.json()).then(j=>{setData(j);setLoading(false)}).catch(()=>{setError('Não foi possível carregar a agenda.');setLoading(false)})},[]);
  const user=data.users.find(u=>u.id===data.userId);
  const dates=useMemo(()=>Array.from({length:5},(_,i)=>addDays(monday(week),i)),[week]);
  const myAv=data.availability.filter(a=>a.userId===data.userId&&dates.some(d=>iso(d)===a.date));
  const selectedDuration=custom?Number(custom):duration;
  const common=useMemo(()=>{
    if(!data.userId||!person||!selectedDuration)return [] as {date:string;start:number}[];
    const out:{date:string;start:number}[]=[];
    dates.forEach(d=>{
      const key=iso(d),mine=data.availability.filter(a=>a.userId===data.userId&&a.date===key),theirs=data.availability.filter(a=>a.userId===person&&a.date===key);
      mine.forEach(a=>theirs.forEach(b=>{const from=Math.max(a.startMinute,b.startMinute),to=Math.min(a.endMinute,b.endMinute);for(let t=Math.ceil(from/15)*15;t+selectedDuration<=to;t+=30)out.push({date:key,start:t})}))
    });return out.slice(0,12)
  },[data,person,selectedDuration,dates]);
  const post=async(body:object)=>{setError('');const r=await fetch('/api/agenda',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Algo deu errado.');return j};
  const login=async(e:React.FormEvent)=>{e.preventDefault();try{await post({action:'login',email,password});await refresh()}catch(err){setError((err as Error).message)}};
  const logout=async()=>{await post({action:'logout'});await refresh();setView('agenda')};
  const addAvailability=async(e:React.FormEvent)=>{e.preventDefault();try{const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);const base=new Date(`${date}T12:00:00`);let sendDates=[date];if(repeat==='4weeks')sendDates=Array.from({length:4},(_,i)=>iso(addDays(base,i*7)));if(repeat==='week')sendDates=dates.map(iso);await post({action:'addAvailability',dates:sendDates,startMinute:sh*60+sm,endMinute:eh*60+em});setModal(false);setToast('Disponibilidade salva');await refresh()}catch(err){setError((err as Error).message)}};
  const remove=async(id:number)=>{await post({action:'deleteAvailability',id});await refresh()};
  const book=async(slot:{date:string;start:number})=>{await post({action:'book',participantId:person,date:slot.date,startMinute:slot.start,duration:selectedDuration});setToast('Reunião agendada!');setView('meetings');await refresh()};
  if(loading)return <main className="app-shell"><section className="phone-surface loading"><div className="brand-mark"><span/><span/></div><p>Organizando agendas…</p></section></main>;
  if(!user)return <main className="app-shell"><section className="phone-surface login-screen"><div className="brand-mark"><span/><span/></div><p className="eyebrow center">Agenda em comum</p><h1 className="login-title">Horários que<br/>combinam.</h1><p className="login-subtitle">Cruze agendas, encontre um horário e marque a reunião sem troca de mensagens.</p><form onSubmit={login}><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></label><label>Senha<input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></label>{error&&<p className="form-error">{error}</p>}<button className="login-button">Entrar <span>→</span></button></form><div className="demo-block"><div className="demo-title"><span>Versão de teste</span><i/></div><p>Escolha um perfil para preencher o acesso:</p><div className="demo-list">{demos.map(u=><button key={u.email} onClick={()=>{setEmail(u.email);setPassword('demo123')}}><span className={`avatar small ${u.tone}`}>{u.initials}</span><span><strong>{u.name}</strong><small>{u.role}</small></span><i>{email===u.email?'✓':'›'}</i></button>)}</div><p className="demo-password">Senha de todos: <strong>demo123</strong></p></div></section></main>;
  return <main className="app-shell"><section className="phone-surface dashboard-screen">
    <header className="mobile-header"><div><p className="eyebrow">Agenda em comum</p><h1>{view==='agenda'?`Olá, ${user.name.split(' ')[0]}!`:view==='find'?'Encontrar horário':'Suas reuniões'}</h1></div><button className={`avatar ${user.tone}`} onClick={logout} title="Sair">{user.initials}</button></header>
    {toast&&<button className="toast" onClick={()=>setToast('')}>{toast} <span>×</span></button>}{error&&<p className="form-error page-error">{error}</p>}
    {view==='agenda'&&<><section className="week-heading"><button className="round-button" onClick={()=>setWeek(addDays(week,-7))}>‹</button><div><p className="muted">Sua disponibilidade</p><h2>{dateLabel(dates[0])} — {dateLabel(dates[4])}</h2></div><button className="round-button" onClick={()=>setWeek(addDays(week,7))}>›</button></section><div className="week-strip">{dates.map((d,i)=><article className="day-column" key={iso(d)}><span>{days[i]}</span><strong>{d.getDate()}</strong><div className="slot-stack">{myAv.filter(a=>a.date===iso(d)).map(a=><button key={a.id} onClick={()=>remove(a.id)}>{hm(a.startMinute)}<small>{hm(a.endMinute)}</small></button>)}{!myAv.some(a=>a.date===iso(d))&&<em>livre?</em>}</div></article>)}</div><button className="primary-action" onClick={()=>{setDate(iso(dates[0]));setModal(true)}}><span>＋</span> Adicionar disponibilidade</button><section className="find-card" onClick={()=>setView('find')}><div className="find-icon">⌁</div><div><p className="eyebrow">Cruzar agendas</p><h3>Encontre o melhor horário</h3><p>Veja quando você e outra pessoa estão livres.</p></div><button>›</button></section></>}
    {view==='find'&&<section className="find-screen"><p className="section-kicker">1 · Com quem?</p><div className="people-list">{data.users.filter(u=>u.id!==user.id).map(u=><button className={person===u.id?'selected':''} key={u.id} onClick={()=>setPerson(u.id)}><span className={`avatar small ${u.tone}`}>{u.initials}</span><span><strong>{u.name}</strong><small>{u.role}</small></span><i>{person===u.id?'✓':''}</i></button>)}</div><p className="section-kicker">2 · Duração</p><div className="duration-row">{[30,45,60].map(n=><button className={!custom&&duration===n?'selected':''} key={n} onClick={()=>{setDuration(n);setCustom('')}}>{n} min</button>)}</div><label className="custom-duration">Duração personalizada<input type="number" min="15" max="180" placeholder="Ex.: 90" value={custom} onChange={e=>setCustom(e.target.value)}/><span>min</span></label><p className="section-kicker">3 · Horários em comum</p><div className="results">{common.length?common.map((s,i)=><button key={`${s.date}-${s.start}-${i}`} onClick={()=>book(s)}><span><strong>{new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(new Date(s.date+'T12:00'))}</strong><small>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(s.date+'T12:00')).replace('.','')}</small></span><b>{hm(s.start)} – {hm(s.start+selectedDuration)}</b><i>Agendar</i></button>):<div className="empty"><b>Nenhum horário em comum</b><span>Adicione mais disponibilidade ou tente outra pessoa.</span></div>}</div></section>}
    {view==='meetings'&&<section className="meetings-screen"><p className="section-kicker">Próximos encontros</p>{data.meetings.length?data.meetings.map(m=>{const peer=data.users.find(u=>u.id===(m.organizerId===user.id?m.participantId:m.organizerId));return <article key={m.id}><div className="meeting-date"><b>{new Date(m.date+'T12:00').getDate()}</b><span>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(m.date+'T12:00')).replace('.','')}</span></div><div><h3>{peer?.name}</h3><p>{hm(m.startMinute)} – {hm(m.startMinute+m.duration)} · {m.duration} min</p></div><span className={`avatar small ${peer?.tone}`}>{peer?.initials}</span></article>}):<div className="empty tall"><b>Nenhuma reunião ainda</b><span>Encontre um horário em comum para começar.</span><button onClick={()=>setView('find')}>Encontrar horário</button></div>}</section>}
    <nav className="bottom-nav"><button className={view==='agenda'?'active':''} onClick={()=>setView('agenda')}><span>▦</span>Agenda</button><button className={view==='find'?'active':''} onClick={()=>setView('find')}><span>⌕</span>Encontrar</button><button className={view==='meetings'?'active':''} onClick={()=>setView('meetings')}><span>◷</span>Reuniões</button></nav>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><form className="sheet" onSubmit={addAvailability} onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="eyebrow">Novo intervalo</p><h2>Quando você está livre?</h2></div><button type="button" onClick={()=>setModal(false)}>×</button></div><label>Dia<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><div className="time-row"><label>De<input type="time" min="07:00" max="18:00" value={start} onChange={e=>setStart(e.target.value)}/></label><span>→</span><label>Até<input type="time" min="07:00" max="18:00" value={end} onChange={e=>setEnd(e.target.value)}/></label></div><label>Repetir<select value={repeat} onChange={e=>setRepeat(e.target.value)}><option value="once">Somente neste dia</option><option value="4weeks">Mesmo dia nas próximas 4 semanas</option><option value="week">Copiar para toda esta semana</option></select></label><p className="limit-note">Disponibilidades permitidas entre 07:00 e 18:00.</p><button className="login-button">Salvar intervalo <span>→</span></button></form></div>}
  </section></main>
}
