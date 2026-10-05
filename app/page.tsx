'use client';

import { useEffect, useMemo, useState } from 'react';

type User={id:string;name:string;email:string;role:string;initials:string;tone:string};
type RecurrenceType='once'|'daily'|'weekly';
type Avail={id:number;userId:string;date:string;startMinute:number;endMinute:number;recurrenceGroupId:string|null;recurrenceType:RecurrenceType};
type MeetingStatus='scheduled'|'happened'|'no_show'|'rescheduling'|'interest_future'|'discarded';
type MeetingType='AP'|'DIAG';
type Meeting={id:number;organizerId:string;participantId:string;date:string;startMinute:number;duration:number;title:string;meetingGroupId:string;meetingType:MeetingType;status:MeetingStatus};
type Data={userId?:string;users:User[];availability:Avail[];meetings:Meeting[]};
type Slot={date:string;start:number;personIds:string[]};
type MeetingGroup={id:string;title:string;organizerId:string;participantIds:string[];date:string;startMinute:number;duration:number;meetingType:MeetingType;status:MeetingStatus};
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
const statusLabel:Record<MeetingStatus,string>={scheduled:'Agendada',happened:'Aconteceu',no_show:'No-show',rescheduling:'Remarcando',interest_future:'Interesse futuro',discarded:'Descartado'};
const TrashIcon=()=> <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 10v7m4-7v7"/></svg>;
const SearchIcon=()=> <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>;

export default function Home(){
  const [email,setEmail]=useState('hunter@demo.com'),[password,setPassword]=useState('demo123');
  const [data,setData]=useState<Data>({users:[],availability:[],meetings:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState('');
  const [view,setView]=useState<View>('agenda'),[week,setWeek]=useState(new Date('2026-10-05T12:00:00'));
  const [availabilityModal,setAvailabilityModal]=useState(false),[editing,setEditing]=useState<Avail|null>(null);
  const [date,setDate]=useState('2026-10-05'),[start,setStart]=useState('08:00'),[end,setEnd]=useState('10:00'),[repeat,setRepeat]=useState<RecurrenceType>('once');
  const [deleteRecurring,setDeleteRecurring]=useState<Avail|null>(null);
  const [selectedPeople,setSelectedPeople]=useState<string[]>([]),[peopleOpen,setPeopleOpen]=useState(false),[search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState<RoleFilter>('Todos');
  const [duration,setDuration]=useState(30),[custom,setCustom]=useState('');
  const [bookingSlot,setBookingSlot]=useState<Slot|null>(null),[meetingTitle,setMeetingTitle]=useState('');
  const [meetingType,setMeetingType]=useState<MeetingType>('DIAG'),[editingMeeting,setEditingMeeting]=useState<MeetingGroup|null>(null),[statusMenu,setStatusMenu]=useState(false);
  const [editMeetingTitle,setEditMeetingTitle]=useState(''),[editMeetingType,setEditMeetingType]=useState<MeetingType>('DIAG'),[editMeetingStatus,setEditMeetingStatus]=useState<MeetingStatus>('scheduled'),[editMeetingDate,setEditMeetingDate]=useState(''),[editMeetingStart,setEditMeetingStart]=useState('08:00'),[editMeetingDuration,setEditMeetingDuration]=useState(30);
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
    const isBusy=(personId:string,day:string,from:number,to:number)=>data.meetings.some(meeting=>meeting.date===day&&meeting.status!=='discarded'&&(meeting.organizerId===personId||meeting.participantId===personId)&&meeting.startMinute<to&&meeting.startMinute+meeting.duration>from);
    for(const dayDate of dates){
      const day=iso(dayDate),mine=data.availability.filter(item=>item.userId===data.userId&&item.date===day);
      for(const personId of selectedPeople){
        const theirs=data.availability.filter(item=>item.userId===personId&&item.date===day);
        mine.forEach(a=>theirs.forEach(b=>{
          const from=Math.max(a.startMinute,b.startMinute),to=Math.min(a.endMinute,b.endMinute);
          for(let time=Math.ceil(from/15)*15;time+selectedDuration<=to;time+=30){
            if(isBusy(data.userId!,day,time,time+selectedDuration)||isBusy(personId,day,time,time+selectedDuration))continue;
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
      const existing=groups.get(meeting.meetingGroupId)??{id:meeting.meetingGroupId,title:meeting.title,organizerId:meeting.organizerId,participantIds:[],date:meeting.date,startMinute:meeting.startMinute,duration:meeting.duration,meetingType:meeting.meetingType,status:meeting.status};
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
  const meetingCalendarWeeks=useMemo(()=>{
    if(meetingPeriod==='week')return [dates];
    const first=new Date(week.getFullYear(),week.getMonth(),1,12),last=new Date(week.getFullYear(),week.getMonth()+1,0,12),result:Date[][]=[];
    for(let cursor=monday(first);cursor<=last;cursor=addDays(cursor,7))result.push(Array.from({length:5},(_,index)=>addDays(cursor,index)));
    return result;
  },[dates,meetingPeriod,week]);

  const login=async(event:React.FormEvent)=>{event.preventDefault();try{await post({action:'login',email,password});await refresh()}catch(err){setError((err as Error).message)}};
  const logout=async()=>{await post({action:'logout'});await refresh();setView('agenda')};
  const openNew=(selectedDate:string)=>{setEditing(null);setDate(selectedDate);setStart('08:00');setEnd('10:00');setRepeat('once');setAvailabilityModal(true)};
  const openEdit=(item:Avail)=>{setEditing(item);setDate(item.date);setStart(hm(item.startMinute));setEnd(hm(item.endMinute));setAvailabilityModal(true)};
  const saveAvailability=async(event:React.FormEvent)=>{event.preventDefault();try{const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);await post(editing?{action:'updateAvailability',id:editing.id,date,startMinute:sh*60+sm,endMinute:eh*60+em}:{action:'addAvailability',date,recurrence:repeat,startMinute:sh*60+sm,endMinute:eh*60+em});setAvailabilityModal(false);setToast(editing?'Horário atualizado':'Horário adicionado');await refresh()}catch(err){setError((err as Error).message)}};
  const performDeleteAvailability=async(item:Avail,scope:'single'|'future')=>{try{await post({action:'deleteAvailability',id:item.id,scope});setAvailabilityModal(false);setDeleteRecurring(null);setEditing(null);setToast(scope==='future'?'Horários seguintes excluídos':'Horário excluído');await refresh()}catch(err){setError((err as Error).message)}};
  const requestDeleteAvailability=()=>{if(!editing)return;if(editing.recurrenceGroupId){setAvailabilityModal(false);setDeleteRecurring(editing)}else{void performDeleteAvailability(editing,'single')}};
  const togglePerson=(id:string)=>setSelectedPeople(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const confirmBooking=async(event:React.FormEvent)=>{event.preventDefault();if(!bookingSlot)return;try{await post({action:'book',participantIds:bookingSlot.personIds,date:bookingSlot.date,startMinute:bookingSlot.start,duration:selectedDuration,title:meetingTitle,meetingType});setBookingSlot(null);setMeetingTitle('');setMeetingType('DIAG');setToast('Reunião agendada');setView('meetings');await refresh()}catch(err){setError((err as Error).message)}};
  const openMeeting=(group:MeetingGroup)=>{setEditingMeeting(group);setEditMeetingTitle(group.title);setEditMeetingType(group.meetingType);setEditMeetingStatus(group.status);setEditMeetingDate(group.date);setEditMeetingStart(hm(group.startMinute));setEditMeetingDuration(group.duration);setStatusMenu(false)};
  const saveMeeting=async(event:React.FormEvent)=>{event.preventDefault();if(!editingMeeting)return;const [hour,minute]=editMeetingStart.split(':').map(Number);try{await post({action:'updateMeeting',meetingGroupId:editingMeeting.id,title:editMeetingTitle,meetingType:editMeetingType,status:editMeetingStatus,date:editMeetingDate,startMinute:hour*60+minute,duration:editMeetingDuration});setEditingMeeting(null);setToast('Reunião atualizada');await refresh()}catch(err){setError((err as Error).message)}};
  const cancelMeeting=async(groupId:string)=>{await post({action:'cancelMeeting',meetingGroupId:groupId});setEditingMeeting(null);setToast('Reunião desmarcada');await refresh()};

  if(loading)return <main className="app-shell"><section className="phone-surface loading"><div className="brand-mark"><span/><span/></div></section></main>;
  if(!user)return <main className="app-shell"><section className="phone-surface login-screen"><div className="brand-mark"><span/><span/></div><p className="eyebrow center">Portal de Agendas Projep Jr.</p><h1 className="login-title">Horários que<br/>combinam.</h1><form onSubmit={login}><label>E-mail<input value={email} onChange={event=>setEmail(event.target.value)} type="email"/></label><label>Senha<input value={password} onChange={event=>setPassword(event.target.value)} type="password"/></label>{error&&<p className="form-error">{error}</p>}<button className="login-button">Entrar <span>→</span></button></form><div className="demo-block"><div className="demo-list">{demos.map(item=><button key={item.email} onClick={()=>{setEmail(item.email);setPassword('demo123')}}><span className={`avatar small ${item.tone}`}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><i>{email===item.email?'✓':'›'}</i></button>)}</div><p className="demo-password">Senha: <strong>demo123</strong></p></div></section></main>;

  const monthMode=meetingPeriod==='month'&&view==='meetings';
  const navigate=(amount:number)=>setWeek(current=>monthMode?addMonths(current,amount):addDays(current,amount*7));
  const weekNavigation=<section className="week-heading"><button className="round-button" onClick={()=>navigate(-1)}>‹</button><h2>{monthMode?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(week):`${dateLabel(dates[0])} — ${dateLabel(dates[4])}`}</h2><button className="round-button" onClick={()=>navigate(1)}>›</button></section>;
  const canEditMeeting=editingMeeting?[editingMeeting.organizerId,...editingMeeting.participantIds].includes(user.id):false;

  return <main className="app-shell"><section className="phone-surface dashboard-screen">
    <header className="mobile-header"><div><p className="eyebrow">Portal de Agendas Projep Jr.</p><h1>{view==='agenda'?`Olá, ${user.name.split(' ')[0]}!`:view==='find'?'Encontrar':'Reuniões'}</h1></div><button className={`avatar ${user.tone}`} onClick={logout} title="Sair">{user.initials}</button></header>
    {toast&&<button className="toast" onClick={()=>setToast('')}>{toast}<span>×</span></button>}{error&&<p className="form-error page-error">{error}</p>}

    {view==='agenda'&&<section className="agenda-screen">{weekNavigation}<div className="week-strip agenda-calendar">{dates.map((dayDate,index)=><article className="day-column clickable" key={iso(dayDate)} onClick={()=>openNew(iso(dayDate))}><button className="day-trigger"><span>{days[index]}</span><strong>{dayDate.getDate()}</strong></button><div className="slot-stack">{myAvailability.filter(item=>item.date===iso(dayDate)).map(item=><button key={item.id} onClick={event=>{event.stopPropagation();openEdit(item)}}>{hm(item.startMinute)}<small>{hm(item.endMinute)}</small></button>)}{!myAvailability.some(item=>item.date===iso(dayDate))&&<em>＋</em>}</div></article>)}</div><button className="primary-action" onClick={()=>openNew(iso(dates[0]))}><span>＋</span> Disponibilidade</button></section>}

    {view==='find'&&<section className="find-screen"><div className={`people-picker ${peopleOpen?'open':''}`}><button className="people-summary" onClick={()=>setPeopleOpen(open=>!open)}><span>{selectedPeople.length?`${selectedPeople.length} selecionada${selectedPeople.length>1?'s':''}`:'Selecionar pessoas'}</span><i>{peopleOpen?'⌃':'⌄'}</i></button>{selectedPeople.length>0&&<div className="selected-chips">{selectedPeople.map(id=>{const person=data.users.find(item=>item.id===id);return person?<button key={id} onClick={()=>togglePerson(id)}>{person.name.split(' ')[0]} <span>×</span></button>:null})}</div>}{peopleOpen&&<div className="people-panel"><label className="search-field"><span className="search-icon"><SearchIcon/></span><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar"/></label><div className="role-filters">{(['Todos','Closer','Hunter','Gerente'] as RoleFilter[]).map(role=><button className={roleFilter===role?'selected':''} key={role} onClick={()=>setRoleFilter(role)}>{role}</button>)}</div><div className="people-options compact-people">{filteredPeople.map(person=><button className={selectedPeople.includes(person.id)?'selected':''} key={person.id} onClick={()=>togglePerson(person.id)}><span className={`avatar mini ${person.tone}`}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span><i>{selectedPeople.includes(person.id)?'✓':''}</i></button>)}</div><div className="people-footer"><button className="done-button" onClick={()=>setPeopleOpen(false)}>Concluir</button></div></div>}</div><div className="duration-row compact-duration">{[30,45,60].map(value=><button className={!custom&&duration===value?'selected':''} key={value} onClick={()=>{setDuration(value);setCustom('')}}>{value} min</button>)}</div><label className="custom-duration minimal-input"><input type="number" min="15" max="180" placeholder="Duração personalizada" value={custom} onChange={event=>setCustom(event.target.value)}/><span>min</span></label>{weekNavigation}<div className="common-week week-strip">{dates.map((dayDate,index)=>{const slots=common.filter(slot=>slot.date===iso(dayDate));return <article className="day-column" key={iso(dayDate)}><div className="day-trigger"><span>{days[index]}</span><strong>{dayDate.getDate()}</strong></div><div className="common-slot-stack">{slots.map(slot=><button key={slot.start} onClick={()=>{setBookingSlot(slot);setMeetingTitle('')}}><b>{hm(slot.start)}</b><small>{hm(slot.start+selectedDuration)}</small><em>{slot.personIds.map(id=>data.users.find(item=>item.id===id)?.name.split(' ')[0]).filter(Boolean).join(', ')}</em></button>)}{!slots.length&&<i>—</i>}</div></article>})}</div></section>}

    {view==='meetings'&&<section className="meetings-screen"><div className="meeting-filters"><div>{(['week','month'] as const).map(value=><button className={meetingPeriod===value?'selected':''} key={value} onClick={()=>setMeetingPeriod(value)}>{value==='week'?'Semana':'Mês'}</button>)}</div><div>{(['mine','all'] as const).map(value=><button className={meetingScope===value?'selected':''} key={value} onClick={()=>setMeetingScope(value)}>{value==='mine'?'Minhas':'Todas'}</button>)}</div></div>{weekNavigation}<div className="meeting-calendar">{meetingCalendarWeeks.map(calendarWeek=><div className="meeting-week week-strip" key={iso(calendarWeek[0])}>{calendarWeek.map((dayDate,index)=>{const dayMeetings=meetingGroups.filter(group=>group.date===iso(dayDate));return <article className={`day-column meeting-day ${dayDate.getMonth()!==week.getMonth()&&meetingPeriod==='month'?'outside-month':''}`} key={iso(dayDate)}><div className="day-trigger"><span>{days[index]}</span><strong>{dayDate.getDate()}</strong></div><div className="meeting-slot-stack">{dayMeetings.map(group=>{const names=[group.organizerId,...group.participantIds].map(id=>data.users.find(item=>item.id===id)?.name.split(' ')[0]).filter(Boolean);return <button className={`meeting-card status-${group.status}`} key={group.id} onClick={()=>openMeeting(group)}><span><b>{hm(group.startMinute)}</b><i>{group.meetingType}</i></span><strong>{group.title}</strong><small>{names.join(' · ')}</small></button>})}{!dayMeetings.length&&<i>—</i>}</div></article>})}</div>)}</div></section>}

    <nav className="bottom-nav"><button className={view==='agenda'?'active':''} onClick={()=>setView('agenda')}><span>▦</span>Agenda</button><button className={view==='find'?'active':''} onClick={()=>setView('find')}><span>⌕</span>Encontrar</button><button className={view==='meetings'?'active':''} onClick={()=>setView('meetings')}><span>◷</span>Reuniões</button></nav>

    {availabilityModal&&<div className="modal-backdrop" onClick={()=>setAvailabilityModal(false)}><form className="sheet" onSubmit={saveAvailability} onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>{editing?'Editar horário':'Novo horário'}</h2><button type="button" onClick={()=>setAvailabilityModal(false)}>×</button></div><label>Dia<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><div className="time-row"><label>De<input type="time" min="07:00" max="18:00" value={start} onChange={event=>setStart(event.target.value)}/></label><span>→</span><label>Até<input type="time" min="07:00" max="18:00" value={end} onChange={event=>setEnd(event.target.value)}/></label></div>{!editing&&<label>Repetir<select value={repeat} onChange={event=>setRepeat(event.target.value as RecurrenceType)}><option value="once">Somente neste dia</option><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option></select></label>}<div className={`sheet-actions ${editing?'with-delete':''}`}>{editing&&<button className="delete-button" type="button" onClick={requestDeleteAvailability} title="Excluir" aria-label="Excluir horário"><TrashIcon/></button>}<button className="save-button">Salvar</button></div></form></div>}

    {deleteRecurring&&<div className="modal-backdrop" onClick={()=>setDeleteRecurring(null)}><section className="sheet recurrence-delete-sheet" onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>Excluir evento recorrente</h2><button type="button" onClick={()=>setDeleteRecurring(null)}>×</button></div><div className="recurrence-delete-options"><button type="button" onClick={()=>void performDeleteAvailability(deleteRecurring,'single')}><strong>Este evento</strong><small>Exclui somente {new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${deleteRecurring.date}T12:00:00`))}.</small></button><button type="button" onClick={()=>void performDeleteAvailability(deleteRecurring,'future')}><strong>Todos os eventos seguintes</strong><small>Exclui este horário e as próximas repetições.</small></button></div></section></div>}

    {bookingSlot&&<div className="modal-backdrop" onClick={()=>setBookingSlot(null)}><form className="sheet booking-sheet" onSubmit={confirmBooking} onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>Agendar</h2><button type="button" onClick={()=>setBookingSlot(null)}>×</button></div><input autoFocus required maxLength={80} value={meetingTitle} onChange={event=>setMeetingTitle(event.target.value)} placeholder="Nome da reunião"/><div className="type-picker">{(['AP','DIAG'] as MeetingType[]).map(value=><button type="button" className={meetingType===value?'selected':''} key={value} onClick={()=>setMeetingType(value)}>{value}</button>)}</div><div className="compact-footer"><button className="save-button">Agendar</button></div></form></div>}

    {editingMeeting&&<div className="modal-backdrop" onClick={()=>setEditingMeeting(null)}><form className="sheet meeting-sheet" onSubmit={saveMeeting} onClick={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span className="meeting-type-label">{editMeetingType}</span><h2>Editar reunião</h2></div><div className="meeting-menu">{canEditMeeting&&<><button className="more-button" type="button" onClick={()=>setStatusMenu(value=>!value)}>•••</button>{statusMenu&&<div className="status-menu">{(['happened','no_show','interest_future','rescheduling','discarded'] as MeetingStatus[]).map(value=><button type="button" className={`status-option status-${value}`} key={value} onClick={()=>{setEditMeetingStatus(value);setStatusMenu(false)}}><i/>{statusLabel[value]}</button>)}</div>}</>}<button type="button" onClick={()=>setEditingMeeting(null)}>×</button></div></div><input required disabled={!canEditMeeting} maxLength={80} value={editMeetingTitle} onChange={event=>setEditMeetingTitle(event.target.value)} placeholder="Nome da reunião"/><div className="type-picker">{(['AP','DIAG'] as MeetingType[]).map(value=><button type="button" disabled={!canEditMeeting} className={editMeetingType===value?'selected':''} key={value} onClick={()=>setEditMeetingType(value)}>{value}</button>)}</div><label>Dia<input type="date" disabled={!canEditMeeting} value={editMeetingDate} onChange={event=>setEditMeetingDate(event.target.value)}/></label><div className="time-row"><label>Horário<input type="time" min="07:00" max="18:00" disabled={!canEditMeeting} value={editMeetingStart} onChange={event=>setEditMeetingStart(event.target.value)}/></label><label>Duração<select disabled={!canEditMeeting} value={editMeetingDuration} onChange={event=>setEditMeetingDuration(Number(event.target.value))}>{[30,45,60].map(value=><option key={value} value={value}>{value} min</option>)}</select></label></div><div className={`current-status status-${editMeetingStatus}`}><i/>{statusLabel[editMeetingStatus]}</div>{canEditMeeting&&<div className="compact-footer split"><button className="delete-button" type="button" onClick={()=>cancelMeeting(editingMeeting.id)} title="Excluir" aria-label="Excluir reunião"><TrashIcon/></button><button className="save-button">Salvar</button></div>}</form></div>}
  </section></main>;
}
