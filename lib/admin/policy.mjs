export function canManageUser(actorRole,targetRole,nextRole){
 return actorRole==='OWNER'||(actorRole==='ADMIN'&&targetRole!=='OWNER'&&nextRole!=='OWNER');
}
export function validatePassword(password,confirmation){
 if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('Use uma senha entre 12 e 256 caracteres.');
 if(password!==confirmation)throw new Error('A confirmação de senha não confere.');return password;
}
export function destinationUrl(value){
 try{const u=new URL(value);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href;}catch{}
 throw new Error('Informe uma URL HTTP ou HTTPS válida, sem credenciais.');
}
export const adPositions={homeBetween:'HOME_BETWEEN_SECTIONS',homeBottom:'HOME_BOTTOM',newsTop:'NEWS_TOP',newsBottom:'NEWS_BOTTOM',footer:'FOOTER'};
export function selectCampaign(campaigns,now=Date.now()){
 const eligible=campaigns.filter(c=>c.active&&new Date(c.start_at).getTime()<=now&&(!c.end_at||new Date(c.end_at).getTime()>now));
 const priority=Math.max(...eligible.map(c=>c.priority));const tier=eligible.filter(c=>c.priority===priority).sort((a,b)=>a.id.localeCompare(b.id));
 return tier.length?tier[Math.floor(now/60000)%tier.length]:null;
}
export function ctr(clicks,impressions){return Number(impressions)>0?Number(clicks)/Number(impressions)*100:0;}
export function localDateTime(instant,timezone){
 if(!instant)return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
