import {timingSafeEqual} from 'node:crypto';
import {synchronizeSources} from '@/server/services/source-automation';
import {runNewsRetention} from '@/server/services/news-lifecycle';
export const runtime='nodejs';
export const maxDuration=300;
async function run(request:Request){
 const secret=process.env.CRON_SECRET||'',header=request.headers.get('authorization')||'';
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(header);
 if(secret.length<32||expected.length!==actual.length||!timingSafeEqual(expected,actual))return Response.json({error:'Unauthorized'},{status:401});
 const params=new URL(request.url).searchParams,task=params.get('task')||'all',dryRun=params.get('dryRun')==='1';
 if(!['all','sync','expire','cleanup'].includes(task))return Response.json({error:'Invalid task'},{status:400});
 if(dryRun&&task==='sync')return Response.json({error:'Use cleanup or all for dry-run'},{status:400});
 try{
  const retention=task==='sync'?null:await runNewsRetention({dryRun,task:task==='all'?'all':task as 'expire'|'cleanup'});
  const synchronization=!dryRun&&(task==='all'||task==='sync')?await synchronizeSources():null;
  return Response.json({retention,synchronization},{headers:{'Cache-Control':'no-store'}});
 }
 catch(error){console.error('source.cron.failed',(error as {code?:string}).code||'SYNC_ERROR');return Response.json({error:'Synchronization unavailable'},{status:503});}
}
export const GET=run;
export const POST=run;
