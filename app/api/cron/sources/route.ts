import {timingSafeEqual} from 'node:crypto';
import {synchronizeSources} from '@/server/services/source-automation';
export const runtime='nodejs';
export const maxDuration=300;
async function run(request:Request){
 const secret=process.env.CRON_SECRET||'',header=request.headers.get('authorization')||'';
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(header);
 if(secret.length<32||expected.length!==actual.length||!timingSafeEqual(expected,actual))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await synchronizeSources(),{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('source.cron.failed',(error as {code?:string}).code||'SYNC_ERROR');return Response.json({error:'Synchronization unavailable'},{status:503});}
}
export const GET=run;
export const POST=run;
