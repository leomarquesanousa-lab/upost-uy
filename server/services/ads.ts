import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db/pool';
import { text,uuid,mediaPath,EditorialError } from '@/lib/editorial/validation';
import { destinationUrl,selectCampaign,adPositions,localDateTime } from '@/lib/admin/policy.mjs';
export type AdSlot={id:string;code:string;name:string;description:string;active:boolean};
export type Campaign={id:string;name:string;advertiser_name:string;slot_id:string;slot_name:string;image_url:string;mobile_image_url:string;alt_text:string;destination_url:string;start_at:string;end_at:string|null;active:boolean;priority:number;impressions:string;clicks:string};
export const topAdSlots = [
 {code:adPositions.homeTop,name:'Inicio — carrusel superior (70%)',description:'Banners de 120 px de alto (100 px en celular). Prioridad mayor primero; las campañas activas rotan cada 6 segundos.'},
 {code:adPositions.homeSidebar,name:'Inicio — publicidad superior (30%)',description:'Junto al carrusel en escritorio y debajo en celular. Se oculta cuando no hay campaña activa.'},
];
export async function portalTimezone(){return 'America/Montevideo';}
export async function advertisingData(){const [slots,campaigns,timezone]=await Promise.all([getPool().query<AdSlot>('SELECT * FROM ad_slots ORDER BY code'),getPool().query<Campaign>('SELECT c.*,c.start_at::text,c.end_at::text,s.name AS slot_name FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id ORDER BY c.created_at DESC'),portalTimezone()]);return {slots:slots.rows,campaigns:campaigns.rows,timezone,now:Date.now()};}
async function parseDate(value:string,timezone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new EditorialError('Informe data e hora válidas.');
 try{const r=await getPool().query('SELECT $1::timestamp AT TIME ZONE $2 AS instant',[value,timezone]);const instant:Date=r.rows[0].instant;if(localDateTime(instant,timezone)!==value)throw new Error();return instant;}catch{throw new EditorialError('Data ou horário inválido no fuso do portal.');}
}
export async function saveCampaign(form:FormData,userId:string){
 const id=form.get('id')?uuid(String(form.get('id'))):randomUUID();
 const name=text(form,'name',120,true),advertiser=text(form,'advertiser_name',160,true),slot=uuid(text(form,'slot_id',36,true));
 const image=mediaPath(text(form,'image_url',200,true)),mobile=mediaPath(text(form,'mobile_image_url',200)),alt=text(form,'alt_text',300,true);
 let destination:string;try{const url=text(form,'destination_url',2048);destination=url?destinationUrl(url):'';}catch(e){throw new EditorialError((e as Error).message);}
 const timezone=await portalTimezone(),start=await parseDate(text(form,'start_at',16,true),timezone),endValue=text(form,'end_at',16),end=endValue?await parseDate(endValue,timezone):null;
 if(end&&end<=start)throw new EditorialError('O término deve ser posterior ao início.');
 const priority=Number(text(form,'priority',4,true));if(!Number.isInteger(priority)||priority<0||priority>1000)throw new EditorialError('Prioridad deve ser um inteiro entre 0 e 1000.');
 const client=await getPool().connect();try{await client.query('BEGIN');
 const assets=await client.query('SELECT path FROM media_assets WHERE path=ANY($1::text[])',[[image,...(mobile?[mobile]:[])]]);if(!assets.rows.some(a=>a.path===image)||(mobile&&!assets.rows.some(a=>a.path===mobile)))throw new EditorialError('Envie as imágenes pelo formulário antes de salvar.');
 const values=[name,advertiser,slot,image,mobile,alt,destination,start,end,form.get('active')==='on',priority,id];
 const result=form.get('id')?await client.query('UPDATE ad_campaigns SET name=$1,advertiser_name=$2,slot_id=$3,image_url=$4,mobile_image_url=$5,alt_text=$6,destination_url=$7,start_at=$8,end_at=$9,active=$10,priority=$11,updated_at=now() WHERE id=$12',values):await client.query('INSERT INTO ad_campaigns(name,advertiser_name,slot_id,image_url,mobile_image_url,alt_text,destination_url,start_at,end_at,active,priority,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',values);
 if(!result.rowCount)throw new EditorialError('Campanha não encontrada.');await client.query('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,\'ad_campaigns\',$3)',[userId,form.get('id')?'ads.updated':'ads.created',id]);await client.query('COMMIT');return id;
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23503')throw new EditorialError('Ubicación publicitária inválida.');throw e;}finally{client.release();}
}
export async function saveAdSlot(form:FormData,userId:string){const id=uuid(text(form,'id',36,true));const client=await getPool().connect();try{await client.query('BEGIN');const r=await client.query('UPDATE ad_slots SET name=$1,description=$2,active=$3,updated_at=now() WHERE id=$4',[text(form,'name',120,true),text(form,'description',600),form.get('active')==='on',id]);if(!r.rowCount)throw new EditorialError('Ubicación inválida.');await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,'ads.slot_updated','ad_slots',$2)",[userId,id]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
export async function createTopAdSlot(form:FormData,userId:string){
 const slot=topAdSlots.find(item=>item.code===text(form,'code',60,true));
 if(!slot)throw new EditorialError('Ubicación inválida.');
 const client=await getPool().connect();try{
  await client.query('BEGIN');
  const id=randomUUID();
  const result=await client.query('INSERT INTO ad_slots(id,code,name,description,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(code) DO NOTHING RETURNING id',[id,slot.code,slot.name,slot.description]);
  if(result.rowCount)await client.query("INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,'ads.slot_created','ad_slots',$2)",[userId,id]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function serveTopBanners(carouselOnly=false){
  const result=await getPool().query<Campaign & {code:string;photo_credit?:{author:string;license:string;source:string}}>(
   `SELECT c.*,s.code,c.start_at::text,c.end_at::text,
    (SELECT a.metadata->'photoCredit' FROM audit_log a WHERE a.entity='ad_campaigns' AND a.entity_id=c.id::text AND a.metadata->>'image_url'=c.image_url AND a.metadata ? 'photoCredit' ORDER BY a.created_at DESC LIMIT 1) AS photo_credit
    FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id WHERE s.code=ANY($1::text[]) AND s.active AND c.active AND c.start_at<=now() AND (c.end_at IS NULL OR c.end_at>now()) ORDER BY c.priority DESC,c.created_at,c.id`,
  [carouselOnly?[adPositions.homeTop]:[adPositions.homeTop,adPositions.homeSidebar]]);
 const slides=result.rows.filter(c=>c.code===adPositions.homeTop);
 const advertisement=selectCampaign(result.rows.filter(c=>c.code===adPositions.homeSidebar)) as Campaign|null;
 if(!slides.length&&!advertisement)return {slides:[],advertisement:null};
  async function delivery(c:Campaign & {photo_credit?:{author:string;license:string;source:string}}){
  // Keep click validation, receipts and impression accounting in the existing system.
  if(c.destination_url)destinationUrl(c.destination_url);mediaPath(c.image_url);mediaPath(c.mobile_image_url);
  const receipt=randomUUID();await getPool().query('INSERT INTO ad_deliveries(id,campaign_id) VALUES($1,$2)',[receipt,c.id]);
   const credit=c.photo_credit?.source?.startsWith('https://commons.wikimedia.org/wiki/File:')?c.photo_credit:undefined;
   return {id:c.id,receipt,image:c.image_url,mobile:c.mobile_image_url,alt:c.alt_text,end:c.end_at,linked:Boolean(c.destination_url),credit};
 }
 const delivered=await Promise.allSettled(slides.map(delivery));
 const side=advertisement?await delivery(advertisement).catch(()=>null):null;
 await getPool().query("DELETE FROM ad_deliveries WHERE id IN (SELECT id FROM ad_deliveries WHERE expires_at<now()-interval '1 day' ORDER BY expires_at LIMIT 100)");
 return {slides:delivered.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),advertisement:side};
}
export async function serveAd(code:string){
 if(!Object.values(adPositions).includes(code))return null;
 const rows=await getPool().query<Campaign>('SELECT c.*,c.start_at::text,c.end_at::text FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id WHERE s.code=$1 AND s.active AND c.active AND c.start_at<=now() AND (c.end_at IS NULL OR c.end_at>now()) ORDER BY c.priority DESC,c.id',[code]);
 const campaign=selectCampaign(rows.rows) as Campaign|null;if(!campaign)return null;
 const receipt=randomUUID();await getPool().query('INSERT INTO ad_deliveries(id,campaign_id) VALUES($1,$2)',[receipt,campaign.id]);
 // Bounded cleanup keeps receipt storage finite without an external worker.
 await getPool().query("DELETE FROM ad_deliveries WHERE id IN (SELECT id FROM ad_deliveries WHERE expires_at<now()-interval '1 day' ORDER BY expires_at LIMIT 100)");
 return {id:campaign.id,receipt,image:campaign.image_url,mobile:campaign.mobile_image_url,alt:campaign.alt_text,end:campaign.end_at,linked:Boolean(campaign.destination_url)};
}
export async function recordAd(id:string,receipt:string,kind:'impression'|'click'){
 uuid(id);uuid(receipt);const client=await getPool().connect();try{await client.query('BEGIN');
 const found=await client.query('SELECT c.destination_url FROM ad_campaigns c JOIN ad_slots s ON s.id=c.slot_id WHERE c.id=$1 AND c.active AND s.active AND c.start_at<=now() AND (c.end_at IS NULL OR c.end_at>now()) FOR UPDATE OF c FOR SHARE OF s',[id]);
 if(!found.rowCount||(kind==='click'&&!found.rows[0].destination_url)){await client.query('ROLLBACK');return null;}
 const delivery=await client.query('SELECT * FROM ad_deliveries WHERE id=$1 AND campaign_id=$2 AND expires_at>now() FOR UPDATE',[receipt,id]);if(!delivery.rowCount){await client.query('ROLLBACK');return null;}
 const column=kind==='click'?'click_at':'impression_at',counter=kind==='click'?'clicks':'impressions';
 if(!delivery.rows[0][column]){await client.query(`UPDATE ad_deliveries SET ${column}=now() WHERE id=$1`,[receipt]);await client.query(`UPDATE ad_campaigns SET ${counter}=${counter}+1 WHERE id=$1`,[id]);}
 const url=found.rows[0].destination_url?destinationUrl(found.rows[0].destination_url):'';await client.query('COMMIT');return kind==='impression'?(url||'recorded'):url;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
