export function montevideoInput(value) {
 if(!value)return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function montevideoInstant(value) {
 if(!value)return '';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Fecha inválida.');
 const instant=new Date(value+':00-03:00');
 if(!Number.isFinite(instant.getTime())||montevideoInput(instant)!==value)throw new Error('Fecha inválida.');
 return instant.toISOString();
}
