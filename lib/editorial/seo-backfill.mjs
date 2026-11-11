import {seoChanges} from './automatic-seo.mjs';

export async function seoBatch(db,{kind,newsTable='public_news',after='',limit=50,apply=false}){
 if(!['news','videos'].includes(kind)||!['public_news','public_news_managed'].includes(newsTable))throw Error('Invalid SEO batch');
 limit=Math.max(1,Math.min(100,Math.trunc(limit)||50));
 const from=kind==='news'?newsTable:'videos';
 const visibility=kind==='videos'?"AND n.deleted_at IS NULL AND n.status='PUBLISHED' AND (n.published_at IS NULL OR n.published_at<=now())":'';
 const rows=(await db.query(`SELECT n.* FROM ${from} n WHERE ($1::uuid IS NULL OR n.id>$1::uuid) ${visibility} ORDER BY n.id LIMIT $2`,[after||null,limit])).rows;
 let changed=0,conflicts=0;const changes=[];
 for(const row of rows){
  const values=seoChanges(row);if(!values)continue;
  changes.push({id:row.id,fields:Object.keys(values).filter(k=>values[k]!==String(row[k]||''))});
  if(apply){
   const visible=kind==='news'?`AND EXISTS(SELECT 1 FROM ${newsTable} p WHERE p.id=n.id)`:visibility;
   const updated=await db.query(`UPDATE ${kind} n SET seo_title=$1,seo_description=$2,version=version+1 WHERE n.id=$3 AND n.version=$4 AND n.seo_title IS NOT DISTINCT FROM $5 AND n.seo_description IS NOT DISTINCT FROM $6 ${visible}`,[values.seo_title,values.seo_description,row.id,row.version,row.seo_title,row.seo_description]);
   if(!updated.rowCount){conflicts++;continue;}
   await db.query("INSERT INTO audit_log(action,entity,entity_id,metadata) VALUES('seo.backfill',$1,$2,$3)",[kind,row.id,JSON.stringify({fields:changes.at(-1).fields})]);
  }
  changed++;
 }
 return {kind,scanned:rows.length,changed,conflicts,after:rows.at(-1)?.id||after,done:rows.length<limit,changes};
}
