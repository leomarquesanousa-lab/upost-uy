// Background entry point for the local scheduler. No interactive window or secrets in arguments.
import {mkdir,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=new URL('../storage/logs/',import.meta.url);await mkdir(folder,{recursive:true});
const log=await open(new URL('sources-'+new Date().toISOString().slice(0,10)+'.log',folder),'a');
await log.write('\n'+JSON.stringify({event:'schedule.start',time:new Date().toISOString()})+'\n');
const child=spawn(process.execPath,['scripts/sync-sources.mjs'],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
const timer=setTimeout(()=>child.kill(),360000);
const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1));});
clearTimeout(timer);await log.write(JSON.stringify({event:'schedule.finish',code,time:new Date().toISOString()})+'\n');await log.close();process.exitCode=code;
