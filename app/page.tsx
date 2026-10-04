'use client';

import { useEffect, useMemo, useState } from 'react';

type User={id:string;name:string;email:string;role:string;initials:string;tone:string};
type Avail={id:number;userId:string;date:string;startMinute:number;endMinute:number};
type Meeting={id:number;organizerId:string;participantId:string;date:string;startMinute:number;duration:number;title:string;meetingGroupId:string};
type Data={userId?:string;users:User[];availability:Avail[];meetings:Meeting[]};
type Slot={date:string;start:number;personIds:string[]};
type MeetingGroup={id:string;title:string;organizerId:string;participantIds:string[];date:string;startMinute:number;duration:number};
type View='agenda'|'find'|'meetings';
type RoleFilter='Todos'|'Closer'|'Hunter'|'Gerente';

const demos=[
  {name:'Marina Alves',role:'Hunter',email:'hunter@demo.com',initials:'MA',tone:'coral'},
  {name:'Bruno Lima',role:'Closer',email:'closer@demo.com',initials:'BL',tone:'blue'},
  {name:'Camila Rocha',role:'Gerente',email:'gerente@demo.com',initials:'CR',tone:'violet'},
];
const days=['SEG','TER','QUA','QUI','SEX'];
const pad=(n:number)=>String(n).padStart(2,'0');
const hm=(m:number)=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const addMonths=(d:Date,n:number)=>{const x=new Date(d);x.setMonth(x.getMonth()+n);return x};
const monday=(d:Date)=>{const x=new Date(d);const dow=x.getDay()||7;x.setDate(x.getDate()-dow+1);x.setHours(12,0,0,0);return x};
const dateLabel=(d:Date)=>new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(d).replace('.','');
const fullDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).format(new Date(`${value}T12:00:00`)).replaceAll('.','');

export default function Home(){
  const [email,setEmail]=useState('hunter@demo.com'),[password,setPassword]=useState('demo123');
  const [data,setData]=useState<Data>({users:[],availability:[],meetings:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState('');
  const [view,setView]=useState<View>('agenda'),[week,setWeek]=useState(new Date('2026-10-05T12:00:00'));
  const [availabilityModal,setAvailabilityModal]=useState(false),[editing,setEditing]=useState<Avail|null>(null);
  const [date,setDate]=useState('2026-10-05'),[start,setStart]=useState('08:00'),[end,setEnd]=useState('10:00'),[repeat,setRepeat]=useState('once');
  const [selectedPeople,setSelectedPeople]=useState<string[]>(['bruno']),[peopleOpen,setPeopleOpen]=useState(false),[search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState<RoleFilter>('Todos');
  const [duration,setDuration]=useState(30),[custom,setCustom]=useState('');
  const [bookingSlot,setBookingSlot]=useState<Slot|null>(null),[meetingTitle,setMeetingTitle]=useState('');
  const [meetingPeriod,setMeetingPeriod]=useState<'week'|'month'>('week'),[meetingScope,setMeetingScope]=useState<'mine'|'all'>('mine');

  const refresh=async()=>{const response=await fetch('/api/agenda');const json=await response.json();if(!response.ok)throw new Error(json.error||'Erro ao carregar.');setData(json);setLoading(false)};
  useEffect(()=>{
    let active=true;
    void fetch('/api/agenda').then(async response=>{
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||'Erro ao carregar.');
      if(active){setData(json);setLoading(false)}
    }).catch(()=>{if(active){setError('Erro ao carregar.');setLoading(false)}});
    return()=>{active=false};
  },[]);
  const post=async(body:object)=>{setError('');const response=await fetch('/api/agenda',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json();if(!response.ok)throw new Error(json.error||'Algo deu errado.');return json};

  const user=data.users.find(item=>item.id===data.userId);
  const dates=useMemo(()=>Array.from({length:5},(_,index)=>addDays(monday(week),index)),[week]);
  const selectedDuration=custom?Number(custom):duration;
  const myAvailability=data.availability.filter(item=>item.userId===data.userId&&dates.some(day=>iso(day)===item.date));
  const filteredPeople=data.users.filter(person=>person.id!==data.userId&&(roleFilter==='Todos'||person.role===roleFilter)&&`${person.name} ${person.role}`.toLowerCase().includes(search.toLowerCase()));

  const common=useMemo(()=>{
    const slots=new Map<string,Slot>();
    if(!data.userId||!selectedPeople.length||!selectedDuration)return [];
    for(const dayDate of dates){
      const day=iso(dayDate),mine=data.availability.filter(item=>item.userId===data.userId&&item.date===day);
      for(const personId of selectedPeople){
        const theirs=data.availability.filter(item=>item.userId===personId&&item.date===day);
        mine.forEach(a=>theirs.forEach(b=>{
          const from=Math.max(a.startMinute,b.startMinute),to=Math.min(a.endMinute,b.endMinute);
          for(let time=Math.ceil(from/15)*15;time+selectedDuration<=to;time+=30){
            const key=`${day}-${time}`,slot=slots.get(key)??{date:day,start:time,personIds:[]};
            if(!slot.personIds.includes(personId))slot.personIds.push(personId);slots.set(key,slot);
          }
        }));
      }
    }
    return [...slots.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  },[data,selectedPeople,selectedDuration,dates]);

  const meetingGroups=useMemo(()=>{
    const groups=new Map<string,MeetingGroup>();
    data.meetings.forEach(meeting=>{
      const existing=groups.get(meeting.meetingGroupId)??{id:meeting.meetingGroupId,title:meeting.title,organizerId:meeting.organizerId,participantIds:[],date:meeting.date,startMinute:meeting.startMinute,duration:meeting.duration};
      if(!existing.participantIds.includes(meeting.participantId))existing.participantIds.push(meeting.participantId);
      groups.set(meeting.meetingGroupId,existing);
    });
    const rangeStart=meetingPeriod==='week'?monday(week):new Date(week.getFullYear(),week.getMonth(),1,12);
    const rangeEnd=meetingPeriod==='week'?addDays(rangeStart,7):new Date(week.getFullYear(),week.getMonth()+1,1,12);
    return [...groups.values()].filter(group=>{
      const value=new Date(`${group.date}T12:00:00`),mine=group.organizerId===data.userId||group.participantIds.includes(data.userId||'');
      return value>=rangeStart&&value<rangeEnd&&(meetingScope==='all'||mine);
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.startMinute-b.startMinute);
  },[data.meetings,data.userId,meetingPeriod,meetingScope,week]);

  const login=async(event:React.FormEvent)=>{event.preventDefault();try{await post({action:'login',email,password});await refresh()}catch(err){setError((err as Error).message)}};
  const logout=async()=>{await post({action:'logout'});await refresh();setView('agenda')};
  const openNew=(selectedDate:string)=>{setEditing(null);setDate(selectedDate);setStart('08:00');setEnd('10:00');setRepeat('once');setAvailabilityModal(true)};
  const openEdit=(item:Avail)=>{setEditing(item);setDate(item.date);setStart(hm(item.startMinute));setEnd(hm(item.endMinute));setAvailabilityModal(true)};
  const saveAvailability=async(event:React.FormEvent)=>{event.preventDefault();try{const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);await post(editing?{action:'updateAvailability',id:editing.id,date,startMinute:sh*60+sm,endMinute:eh*60+em}:{action:'addAvailability',date,recurrence:repeat,startMinute:sh*60+sm,endMinute:eh*60+em});setAvailabilityModal(false);setToast(editing?'Horário atualizado':'Horário adicionado');await refresh()}catch(err){setError((err as Error).message)}};
  const deleteAvailability=async()=>{if(!editing)return;await post({action:'deleteAvailability',id:editing.id});setAvailabilityModal(false);setToast('Horário excluído');await refresh()};
  const togglePerson=(id:string)=>setSelectedPeople(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const confirmBooking=async(event:React.FormEvent)=>{event.preventDefault();if(!bookingSlot)return;try{await post({action:'book',participantIds:bookingSlot.personIds,date:bookingSlot.date,startMinute:bookingSlot.start,duration:selectedDuration,title:meetingTitle});setBookingSlot(null);setMeetingTitle('');setToast('Reunião agendada');setView('meetings');await refresh()}catch(err){setError((err as Error).message)}};
  const cancelMeeting=async(groupId:string)=>{await post({action:'cancelMeeting',meetingGroupId:groupId});setToast('Reunião desmarcada');await refresh()};

  if(loading)return <main className="app-shell"><section className="phone-surface loading"><div className="brand-mark"><span/><span/></div></section></main>;
  if(!user)return <main className="app-shell"><section className="phone-surface login-screen"><div className="brand-mark"><span/><span/></div><p className="eyebrow center">Agenda em comum</p><h1 className="login-title">Horários que<br/>combinam.</h1><form onSubmit={login}><label>E-mail<input value={email} onChange={event=>setEmail(event.target.value)} type="email"/></label><label>Senha<input value={password} onChange={event=>setPassword(event.target.value)} type="password"/></label>{error&&<p className="form-error">{error}</p>}<button className="login-button">Entrar <span>→</span></button></form><div className="demo-block"><div className="demo-list">{demos.map(item=><button key={item.email} onClick={()=>{setEmail(item.email);setPassword('demo123')}}><span className={`avatar small ${item.tone}`}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><i>{email===item.email?'✓':'›'}</i></button>)}</div><p className="demo-password">Senha: <strong>demo123</strong></p></div></section></main>;

  const monthMode=meetingPeriod==='month'&&view==='meetings';
  const navigate=(amount:number)=>setWeek(current=>monthMode?addMonths(current,amount):addDays(current,amount*7));
  const weekNavigation=<section className="week-heading"><button className="round-button" onClick={()=>navigate(-1)}>‹</button><h2>{monthMode?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(week):`${dateLabel(dates[0])} — ${dateLabel(dates[4])}`}</h2><button className="round-button" onClick={()=>navigate(1)}>›</button></section>;

  return <main className="app-shell"><section className="phone-surface dashboard-screen">
    <header className="mobile-header"><div><p className="eyebrow">Agenda em comum</p><h1>{view==='agenda'?`Olá, ${user.name.split(' ')[0]}!`:view==='find'?'Encontrar':'Reuniões'}</h1></div><button className={`avatar ${user.tone}`} onClick={logout} title="Sair">{user.initials}</button></header>
    {toast&&<button className="toast" onClick={()=>setToast('')}>{toast}<span>×</span></button>}{error&&<p className="form-error page-error">{error}</p>}

    {view==='agenda'&&<>{weekNavigation}<div className="week-strip">{dates.map((dayDate,index)=><article className="day-column clickable" key={iso(dayDate)} onClick={()=>openNew(iso(dayDate))}><button className="day-trigger"><span>{days[index]}</span><strong>{dayDate.getDate()}</strong></button><div className="slot-stack">{myAvailability.filter(item=>item.date===iso(dayDate)).map(item=><button key={item.id} onClick={event=>{event.stopPropagation();openEdit(item)}}>{hm(item.startMinute)}<small>{hm(item.endMinute)}</small></button>)}{!myAvailability.some(item=>item.date===iso(dayDate))&&<em>＋</em>}</div></article>)}</div><button className="primary-action" onClick={()=>openNew(iso(dates[0]))}><span>＋</span> Disponibilidade</button></>}

    {view==='find'&&<section className="find-screen"><div className={`people-picker ${peopleOpen?'open':''}`}><button className="people-summary" onClick={()=>setPeopleOpen(open=>!open)}><span>{selectedPeople.length?`${selectedPeople.length} selecionada${selectedPeople.length>1?'s':''}`:'Selecionar pessoas'}</span><i>{peopleOpen?'⌃':'⌄'}</i></button>{selectedPeople.length>0&&<div className="selected-chips">{selectedPeople.map(id=>{const person=data.users.find(item=>item.id===id);return person?<button key={id} onClick={()=>togglePerson(id)}>{person.name.split(' ')[0]} <span>×</span></button>:null})}</div>}{peopleOpen&&<div className="people-panel"><label className="search-field">⌕<input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar"/></label><div className="role-filters">{(['Todos','Closer','Hunter','Gerente'] as RoleFilter[]).map(role=><button className={roleFilter===role?'selected':''} key={role} onClick={()=>setRoleFilter(role)}>{role}</button>)}</div><div className="people-options compact-people">{filteredPeople.map(person=><button className={selectedPeople.includes(person.id)?'selected':''} key={person.id} onClick={()=>togglePerson(person.id)}><span className={`avatar mini ${person.tone}`}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span><i>{selectedPeople.includes(person.id)?'✓':''}</i></button>)}</div><button className="done-button" onClick={()=>setPeopleOpen(false)}>Concluir</button></div>}</div><div className="duration-row compact-duration">{[30,45,60].map(value=><button className={!custom&&duration===value?'selected':''} key={value} onClick={()=>{setDuration(value);setCustom('')}}>{value} min</button>)}</div><label className="custom-duration minimal-input"><input type="number" min="15" max="180" placeholder="Duração personalizada" value={custom} onChange={event=>setCustom(event.target.value)}/><span>min</span></label>{weekNavigation}<div className="common-week week-strip">{dates.map((dayDate,index)=>{const slots=common.filter(slot=>slot.date===iso(dayDate));return <article className="day-column" key={iso(dayDate)}><div className="day-trigger"><span>{days[index]}</span><strong>{dayDate.getDate()}</strong></div><div className="common-slot-stack">{slots.map(slot=><button key={slot.start} onClick={()=>{setBookingSlot(slot);setMeetingTitle('')}}><b>{hm(slot.start)}</b><small>{hm(slot.start+selectedDuration)}</small><em>{slot.personIds.map(id=>data.users.find(item=>item.id===id)?.name.split(' ')[0]).filter(Boolean).join(', ')}</em></button>)}{!slots.length&&<i>—</i>}</div></article>})}</div></section>}

    {view==='meetings'&&<section className="meetings-screen"><div className="meeting-filters"><div>{(['week','month'] as const).map(value=><button className={meetingPeriod===value?'selected':''} key={value} onClick={()=>setMeetingPeriod(value)}>{value==='week'?'Semana':'Mês'}</button>)}</div><div>{(['mine','all'] as const).map(value=><button className={meetingScope===value?'selected':''} key={value} onClick={()=>setMeetingScope(value)}>{value==='mine'?'Minhas':'Todas'}</button>)}</div></div>{weekNavigation}<div className="meeting-list">{meetingGroups.map(group=>{const personIds=[group.organizerId,...group.participantIds],names=personIds.map(id=>data.users.find(item=>item.id===id)?.name).filter(Boolean);const mine=personIds.includes(user.id);return <article key={group.id}><div><h3>{group.title}</h3><p>{names.join(' · ')}</p><time>{fullDate(group.date)} · {hm(group.startMinute)}–{hm(group.startMinute+group.duration)}</time></div>{mine&&<button className="cancel-meeting" onClick={()=>cancelMeeting(group.id)} title="Desmarcar" aria-label="Desmarcar reunião">🗑</button>}</article>})}{!meetingGroups.length&&<div className="empty compact"><b>Nenhuma reunião</b></div>}</div></section>}

    <nav className="bottom-nav"><button className={view==='agenda'?'active':''} onClick={()=>setView('agenda')}><span>▦</span>Agenda</button><button className={view==='find'?'active':''} onClick={()=>setView('find')}><span>⌕</span>Encontrar</button><button className={view==='meetings'?'active':''} onClick={()=>setView('meetings')}><span>◷</span>Reuniões</button></nav>

    {availabilityModal&&<div className="modal-backdrop" onClick={()=>setAvailabilityModal(false)}><form className="sheet" onSubmit={saveAvailability} onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>{editing?'Editar horário':'Novo horário'}</h2><button type="button" onClick={()=>setAvailabilityModal(false)}>×</button></div><label>Dia<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><div className="time-row"><label>De<input type="time" min="07:00" max="18:00" value={start} onChange={event=>setStart(event.target.value)}/></label><span>→</span><label>Até<input type="time" min="07:00" max="18:00" value={end} onChange={event=>setEnd(event.target.value)}/></label></div>{!editing&&<label>Repetir<select value={repeat} onChange={event=>setRepeat(event.target.value)}><option value="once">Somente neste dia</option><option value="daily">Todos os dias úteis</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select></label>}<div className={`sheet-actions ${editing?'with-delete':''}`}>{editing&&<button className="delete-button" type="button" onClick={deleteAvailability} title="Excluir" aria-label="Excluir horário">🗑</button>}<button className="save-button">Salvar</button></div></form></div>}

    {bookingSlot&&<div className="modal-backdrop" onClick={()=>setBookingSlot(null)}><form className="sheet booking-sheet" onSubmit={confirmBooking} onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>Agendar</h2><button type="button" onClick={()=>setBookingSlot(null)}>×</button></div><input autoFocus required maxLength={80} value={meetingTitle} onChange={event=>setMeetingTitle(event.target.value)} placeholder="Nome da reunião"/><button className="save-button">Agendar</button></form></div>}
  </section></main>;
}
