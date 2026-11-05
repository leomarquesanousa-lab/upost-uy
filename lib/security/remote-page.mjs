import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

export class ImportError extends Error {}
export function publicAddress(address) {
  try {
    const ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) return false;
    if (ip.range() !== 'unicast') return false;
    if (ip.kind() === 'ipv6' && !ip.match(ipaddr.parse('2000::'),3)) return false;
    return true;
  } catch { return false; }
}
export function remoteUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new ImportError('Ingresá una URL HTTP o HTTPS válida.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
  if (typeof value !== 'string' || value.length > 2048 || !['http:','https:'].includes(url.protocol) || url.username || url.password || url.port) throw new ImportError('Usá HTTP/HTTPS en puertos estándar, sin credenciales.');
  if (!hostname.includes('.') && !ipaddr.isValid(hostname)) throw new ImportError('Dirección interna bloqueada.');
  if (/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(hostname) || (ipaddr.isValid(hostname) && !publicAddress(hostname))) throw new ImportError('Dirección interna o reservada bloqueada.');
  url.hash = '';
  return url;
}
async function destination(url, resolve) {
  const host = url.hostname.replace(/^\[|\]$/g,'');
  const records = ipaddr.isValid(host) ? [{address:host,family:ipaddr.parse(host).kind()==='ipv4'?4:6}] : await resolve(host,{all:true,verbatim:true});
  if (!records.length || records.some(record=>!publicAddress(record.address))) throw new ImportError('El dominio apunta a una red interna o reservada.');
  return records[0];
}
// DNS é validado e fixado na própria conexão, sem segunda resolução nem proxy de ambiente.
export function requestPage(url, address, signal, maxBytes, image = false, feed = false) {
  return new Promise((resolve,reject)=>{
    const transport = url.protocol==='https:' ? https : http;
    const req = transport.request(url, {
      agent:false, signal, autoSelectFamily:false,
      lookup: (_host,options,callback) => options.all ? callback(null,[address]) : callback(null,address.address,address.family),
      headers:{'User-Agent':'UPOSTEditorial/1.0','Accept':image ? 'image/jpeg,image/png,image/webp' : feed ? 'application/rss+xml,application/atom+xml,application/xml,text/xml' : 'text/html,application/xhtml+xml','Accept-Encoding':'identity'},
    },res=>{
      const status = res.statusCode || 0;
      if ([301,302,303,307,308].includes(status)) { const location=res.headers.location; res.destroy(); resolve({status,location,html:''}); return; }
      if (status<200 || status>=300) { res.destroy(); reject(new ImportError('La fuente no permitió acceder a la página.')); return; }
      const mimeType = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const accepted = image ? ['image/jpeg','image/png','image/webp'].includes(mimeType) : feed ? ['application/rss+xml','application/atom+xml','application/xml','text/xml'].includes(mimeType) : ['text/html','application/xhtml+xml'].includes(mimeType);
      if (!accepted || (res.headers['content-encoding'] && res.headers['content-encoding']!=='identity')) { res.destroy(); reject(new ImportError(image ? 'La fuente no devolvió una imagen JPEG, PNG o WebP.' : 'La respuesta no es una página HTML compatible.')); return; }
      const tooLarge = image ? 'La imagen supera el límite de 5 MB.' : 'La página supera el límite de 2 MB.';
      if (Number(res.headers['content-length'])>maxBytes) { res.destroy(); reject(new ImportError(tooLarge)); return; }
      const chunks=[]; let size=0;
      res.on('data',chunk=>{ size+=chunk.length; if(size>maxBytes) { res.destroy(new ImportError(tooLarge)); } else chunks.push(chunk); });
      res.on('error',reject);
      res.on('end',()=>{
        if (image) { resolve({ status, bytes: Buffer.concat(chunks), mimeType }); return; }
        const charset = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(res.headers['content-type'] || '')?.[1] || 'utf-8';
        try { resolve({status,html:new TextDecoder(charset).decode(Buffer.concat(chunks))}); }
        catch { reject(new ImportError('Codificación de página no compatible.')); }
      });
    });
    req.on('error',reject); req.end();
  });
}
export function requestImage(url, address, signal, maxBytes) {
  return requestPage(url, address, signal, maxBytes, true);
}

export function fetchRemotePage(value, options = {}) {
  return fetchRemoteResource(value, { request: requestPage, maxBytes: 2*1024*1024, ...options }, false);
}

export function fetchRemoteFeed(value, options = {}) {
  return fetchRemoteResource(value, {
    request: (url, address, signal, maxBytes) => requestPage(url, address, signal, maxBytes, false, true),
    maxBytes: 2*1024*1024, ...options,
  }, false);
}

export function fetchRemoteImage(value, options = {}) {
  return fetchRemoteResource(value, { request: requestImage, maxBytes: 5*1024*1024, ...options }, true);
}

async function fetchRemoteResource(value, { resolve=lookup, request, timeoutMs=10000, maxBytes }, image) {
  let url=remoteUrl(value);
  const controller=new AbortController();
  let timer;
  const deadline = new Promise((_,reject)=>{ timer=setTimeout(()=>{controller.abort();reject(new ImportError('La fuente demoró demasiado en responder.'));},timeoutMs); });
  const work = async () => {
    for(let redirects=0;redirects<=3;redirects++) {
      const address=await destination(url,resolve);
      if(controller.signal.aborted) throw new ImportError('Se agotó el tiempo de espera.');
      const response=await request(url,address,controller.signal,maxBytes);
      if(response.location) {
        if(redirects===3) throw new ImportError('Demasiadas redirecciones.');
        url=remoteUrl(new URL(response.location,url).href); continue;
      }
      if(response.status<200 || response.status>=300) throw new ImportError('Respuesta inválida de la fuente.');
      if (image) {
        if (!Buffer.isBuffer(response.bytes) || !response.bytes.length || response.bytes.length > maxBytes || !['image/jpeg','image/png','image/webp'].includes(response.mimeType)) throw new ImportError('Imagen inválida o demasiado grande.');
        return { bytes: response.bytes, mimeType: response.mimeType, url: url.href };
      }
      if(typeof response.html!=='string') throw new ImportError('Respuesta inválida de la fuente.');
      if(Buffer.byteLength(response.html)>maxBytes*2) throw new ImportError('Página demasiado grande.');
      return {html:response.html,url:url.href};
    }
  };
  try { return await Promise.race([work(),deadline]); }
  catch(error) { if(error instanceof ImportError) throw error; throw new ImportError('No se pudo acceder a esta fuente.'); }
  finally { clearTimeout(timer); controller.abort(); }
}
