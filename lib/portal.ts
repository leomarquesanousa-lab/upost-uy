export const sections=[['uruguay','Uruguay'],['mundo','Mundo'],['sociedad','Sociedad'],['deportes','Deportes'],['cultura','Cultura'],['podcast','Podcast'],['especialistas','Especialistas'],['opinion','Opinión'],['investigaciones','Investigaciones']] as const;
export const portalMenu=[['/','Inicio'],['/noticias','Últimas noticias'],...sections.map(([s,l])=>['/'+s,l]),['/radios','Radios en vivo'],['/videos','Videos']] as const;
export const portalDate=(v:Date|string)=>new Intl.DateTimeFormat('es-UY',{dateStyle:'long',timeZone:'America/Montevideo'}).format(new Date(v));
