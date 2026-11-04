export const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export function portalClock(now = new Date(), timezone = 'America/Sao_Paulo') {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`;
 return {date,time:`${parts.hour}:${parts.minute}`,weekday:new Date(`${date}T12:00:00Z`).getUTCDay()};
}
export function addDays(date, count) { const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10); }
export function daySchedule(date, slots, exceptions) {
 const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
 const special=exceptions.filter(s=>s.active && s.date===date);
 let regular=slots.filter(s=>s.active && s.weekday===weekday && s.program?.active).map(s=>({...s,date,start_time:s.start_time.slice(0,5),end_time:s.end_time.slice(0,5)}));
 for(const e of special) regular=regular.flatMap(s=>{
  const start=e.start_time.slice(0,5),end=e.end_time.slice(0,5);
  if(s.end_time<=start || s.start_time>=end)return [s];
  return [...(s.start_time<start?[{...s,end_time:start}]:[]),...(s.end_time>end?[{...s,start_time:end}]:[])];
 });
 return [...regular,...special.filter(e=>!e.cancelled && e.program?.active).map(e=>({...e,special:true,start_time:e.start_time.slice(0,5),end_time:e.end_time.slice(0,5)}))].sort((a,b)=>a.start_time.localeCompare(b.start_time));
}
export function resolveSchedule(slots,exceptions,timezone,now=new Date()) {
 const clock=portalClock(now,timezone);
 const schedule=Array.from({length:8},(_,i)=>daySchedule(addDays(clock.date,i),slots,exceptions)).flat();
 return {clock,current:schedule.find(s=>s.date===clock.date && s.start_time<=clock.time && s.end_time>clock.time)??null,next:schedule.filter(s=>s.date>clock.date || s.start_time>clock.time).slice(0,3)};
}
