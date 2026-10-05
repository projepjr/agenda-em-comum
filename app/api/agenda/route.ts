import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';

const demoUsers = [
  ['marina', 'Marina Alves', 'hunter@demo.com', 'Hunter', 'MA', 'coral'],
  ['bruno', 'Bruno Lima', 'closer@demo.com', 'Closer', 'BL', 'blue'],
  ['camila', 'Camila Rocha', 'gerente@demo.com', 'Gerente', 'CR', 'violet'],
  ['thiago', 'Thiago Brandão', 'thiago@demo.com', 'Hunter', 'TB', 'mint'],
] as const;

type AvailabilityRow = { id:number; user_id:string; date:string; start_minute:number; end_minute:number };
type MeetingRow = { id:number; organizer_id:string; participant_id:string; date:string; start_minute:number; duration:number; title:string; meeting_group_id:string; meeting_type:'AP'|'DIAG'; status:'scheduled'|'happened'|'no_show'|'rescheduling'|'interest_future'|'discarded' };

async function supabase(path:string, init:RequestInit={}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response;
}

function session(request: NextRequest) { return request.cookies.get('agenda_demo_user')?.value; }
async function canManageMeeting(groupId:string,userId:string) {
  const response=await supabase(`agenda_meetings?meeting_group_id=eq.${encodeURIComponent(groupId)}&select=organizer_id,participant_id`);
  const rows=await response.json() as Pick<MeetingRow,'organizer_id'|'participant_id'>[];
  return rows.some(row=>row.organizer_id===userId||row.participant_id===userId);
}
const pad = (value:number) => String(value).padStart(2,'0');
const toIso = (date:Date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const addDays = (date:Date, amount:number) => { const next=new Date(date); next.setDate(next.getDate()+amount); return next; };
const addMonths = (date:Date, amount:number) => { const next=new Date(date); next.setMonth(next.getMonth()+amount); return next; };

function recurrenceDates(baseValue:string, recurrence:string) {
  const base=new Date(`${baseValue}T12:00:00`); if(Number.isNaN(base.getTime()))return [];
  if(recurrence==='daily'){const limit=addMonths(base,12),dates:string[]=[];for(let cursor=new Date(base);cursor<limit;cursor=addDays(cursor,1))if(cursor.getDay()>=1&&cursor.getDay()<=5)dates.push(toIso(cursor));return dates;}
  if(recurrence==='weekly')return Array.from({length:52},(_,index)=>toIso(addDays(base,index*7)));
  if(recurrence==='monthly'){const weekday=base.getDay(),ordinal=Math.floor((base.getDate()-1)/7);return Array.from({length:12},(_,index)=>{const month=new Date(base.getFullYear(),base.getMonth()+index,1,12);const offset=(weekday-month.getDay()+7)%7;const candidate=new Date(month.getFullYear(),month.getMonth(),1+offset+ordinal*7,12);if(candidate.getMonth()!==month.getMonth())candidate.setDate(candidate.getDate()-7);return toIso(candidate);});}
  return [toIso(base)];
}

export async function GET(request:NextRequest) {
  const userId=session(request);
  const [usersResponse,availabilityResponse,meetingsResponse]=await Promise.all([
    supabase('agenda_users?select=*&order=name'),
    supabase('agenda_availability?select=id,user_id,date,start_minute,end_minute&order=date,start_minute'),
    userId?supabase('agenda_meetings?select=id,organizer_id,participant_id,date,start_minute,duration,title,meeting_group_id,meeting_type,status&order=date,start_minute'):null,
  ]);
  const users=await usersResponse.json();
  const availability=((await availabilityResponse.json()) as AvailabilityRow[]).map(row=>({id:row.id,userId:row.user_id,date:row.date,startMinute:row.start_minute,endMinute:row.end_minute}));
  const meetings=meetingsResponse?((await meetingsResponse.json()) as MeetingRow[]).map(row=>({id:row.id,organizerId:row.organizer_id,participantId:row.participant_id,date:row.date,startMinute:row.start_minute,duration:row.duration,title:row.title,meetingGroupId:row.meeting_group_id,meetingType:row.meeting_type,status:row.status})):[];
  return NextResponse.json({userId,users,availability,meetings});
}

export async function POST(request:NextRequest) {
  const body=await request.json() as Record<string,unknown>;
  if(body.action==='login'){
    const user=demoUsers.find(entry=>entry[2]===body.email);
    if(!user||body.password!=='demo123')return NextResponse.json({error:'E-mail ou senha inválidos.'},{status:401});
    const response=NextResponse.json({ok:true,userId:user[0]});response.cookies.set('agenda_demo_user',user[0],{httpOnly:true,sameSite:'lax',secure:true,maxAge:60*60*24*7});return response;
  }
  if(body.action==='logout'){const response=NextResponse.json({ok:true});response.cookies.delete('agenda_demo_user');return response;}
  const userId=session(request);if(!userId)return NextResponse.json({error:'Sessão expirada.'},{status:401});
  if(body.action==='addAvailability'){
    const dates=recurrenceDates(String(body.date),String(body.recurrence||'once')),start=Number(body.startMinute),end=Number(body.endMinute);
    if(!dates.length||start<420||end>1080||end<=start)return NextResponse.json({error:'Use um intervalo entre 07:00 e 18:00.'},{status:400});
    await supabase('agenda_availability?on_conflict=user_id,date,start_minute,end_minute',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(dates.map(date=>({user_id:userId,date,start_minute:start,end_minute:end})))});
    return NextResponse.json({ok:true});
  }
  if(body.action==='deleteAvailability'){
    await supabase(`agenda_availability?id=eq.${Number(body.id)}&user_id=eq.${userId}`,{method:'DELETE'});return NextResponse.json({ok:true});
  }
  if(body.action==='updateAvailability'){
    const id=Number(body.id),date=String(body.date),start=Number(body.startMinute),end=Number(body.endMinute);
    if(!id||start<420||end>1080||end<=start)return NextResponse.json({error:'Use um intervalo entre 07:00 e 18:00.'},{status:400});
    await supabase(`agenda_availability?id=eq.${id}&user_id=eq.${userId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({date,start_minute:start,end_minute:end})});
    return NextResponse.json({ok:true});
  }
  if(body.action==='book'){
    const participantIds=Array.isArray(body.participantIds)?body.participantIds.map(String):[],date=String(body.date),start=Number(body.startMinute),duration=Number(body.duration),title=String(body.title||'').trim().slice(0,80),meetingType=String(body.meetingType),meetingGroupId=crypto.randomUUID();
    if(!participantIds.length||!title||!['AP','DIAG'].includes(meetingType))return NextResponse.json({error:'Informe o nome e o tipo da reunião.'},{status:400});
    try{
      await supabase('rpc/agenda_book_meeting',{method:'POST',body:JSON.stringify({p_organizer_id:userId,p_participant_ids:participantIds,p_date:date,p_start_minute:start,p_duration:duration,p_title:title,p_meeting_type:meetingType,p_group_id:meetingGroupId})});
    }catch(error){
      if((error as Error).message.includes('Horário indisponível'))return NextResponse.json({error:'Esse horário acabou de ser ocupado. Escolha outro.'},{status:409});
      throw error;
    }
    return NextResponse.json({ok:true});
  }
  if(body.action==='updateMeeting'){
    const groupId=String(body.meetingGroupId||''),title=String(body.title||'').trim().slice(0,80),meetingType=String(body.meetingType),status=String(body.status),date=String(body.date),start=Number(body.startMinute),duration=Number(body.duration);
    if(!groupId||!title||!['AP','DIAG'].includes(meetingType)||!['scheduled','happened','no_show','rescheduling','interest_future','discarded'].includes(status)||!date||start<420||start+duration>1080||duration<15)return NextResponse.json({error:'Revise os dados da reunião.'},{status:400});
    if(!await canManageMeeting(groupId,userId))return NextResponse.json({error:'Você não pode editar esta reunião.'},{status:403});
    await supabase(`agenda_meetings?meeting_group_id=eq.${encodeURIComponent(groupId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({title,meeting_type:meetingType,status,date,start_minute:start,duration})});
    return NextResponse.json({ok:true});
  }
  if(body.action==='cancelMeeting'){
    const groupId=String(body.meetingGroupId||'');
    if(!groupId)return NextResponse.json({error:'Reunião inválida.'},{status:400});
    if(!await canManageMeeting(groupId,userId))return NextResponse.json({error:'Você não pode desmarcar esta reunião.'},{status:403});
    await supabase(`agenda_meetings?meeting_group_id=eq.${encodeURIComponent(groupId)}`,{method:'DELETE'});
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:'Ação desconhecida.'},{status:400});
}
