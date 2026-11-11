export const retentionDays = 15;
export const retentionDefaults = Object.freeze({ global_daily_limit:20, min_sync_minutes:60, publication_hours:retentionDays*24, recovery_days:7, active_limit:500, cleanup_enabled:false });
export function retentionInput(form) {
 const limits={global_daily_limit:[1,10000],min_sync_minutes:[60,10080],recovery_days:[1,3650],active_limit:[1,100000]}, result={...retentionDefaults};
 for(const [name,[min,max]]of Object.entries(limits)){const value=Number(form.get(name));if(!Number.isInteger(value)||value<min||value>max)throw Error('Revisá los límites y plazos.');result[name]=value;}
 return {...result,cleanup_enabled:form.get('cleanup_enabled')==='on'};
}
export function remainingImports(policy, counts, sourceLimit=5) {
 return Math.max(0,Math.min(policy.global_daily_limit-counts.global,sourceLimit-counts.source,policy.active_limit-counts.active));
}
export function publicationWindow(now, hours=retentionDefaults.publication_hours, days=7) {
 const first=new Date(now),expires=new Date(first.getTime()+hours*3600000);
 return {first,expires,purge:new Date(expires.getTime()+days*86400000)};
}
export function canPurge(item, now=Date.now()) {
 return Boolean(item.retention_managed&&!item.permanent&&!item.editorial_protected&&!item.featured&&!item.home_lead&&item.trashed_at&&item.trash_reason==='expired'&&item.purge_after&&new Date(item.purge_after).getTime()<=now);
}
export function canManageNews(role, operation) {
 return ['OWNER','ADMIN','EDITOR'].includes(role)&&(!['purge','unprotect'].includes(operation)||role!=='EDITOR');
}
export const managedImagePattern=/^\/media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;
export function managedMediaProof(asset, audit) {
 return Boolean(asset&&managedImagePattern.test(asset.path)&&asset.mime_type==='image/webp'&&audit?.storageProvider==='r2'&&audit.objectKey===asset.path.slice(1)&&['import','manual'].includes(audit.sourceType));
}
