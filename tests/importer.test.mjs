import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { remoteUrl,publicAddress,fetchRemotePage,requestPage,fetchRemoteImage,requestImage } from '../lib/security/remote-page.mjs';
import { extractArticle } from '../lib/editorial/import-article.mjs';
const resolve=async()=>[{address:'93.184.215.14',family:4}];
const fixture=`<html><head><meta property="og:title" content="Ciência na Biosfera"><meta property="og:description" content="Resumo da fonte"><meta property="og:site_name" content="Fonte editorial"><meta property="og:image" content="/foto.jpg"><script type="application/ld+json">{"@type":"NewsArticle","author":{"name":"Autora original"},"datePublished":"2026-09-20T10:00:00Z","image":{"url":"https://example.com/foto.jpg","creditText":"Fotógrafo"}}</script></head><body><nav>Menu</nav><article><h1>Título alternativo</h1><p>Primeiro parágrafo da matéria.</p><h2>Contexto</h2><p>Segundo parágrafo.</p><figure><img src="/foto.jpg" alt="Paisagem"><figcaption>Legenda original</figcaption></figure><script>alert('x')</script></article></body></html>`;
test('URL aceita somente HTTP(S) público padrão e rejeita destinos internos/reservados',()=>{
  for(const url of ['https://example.com/a','http://example.com/a'])assert.ok(remoteUrl(url));
  for(const url of ['invalid','file:///etc/passwd','ftp://example.com','http://localhost','http://localhost.','http://127.1','http://2130706433','http://0x7f000001','http://[::1]','http://[::ffff:127.0.0.1]','http://10.0.0.1','http://172.16.0.1','http://192.168.1.1','http://169.254.169.254','http://100.64.0.1','http://0.0.0.0','http://192.0.2.1','http://metadata.google.internal','https://user:pass@example.com','http://example.com:8080'])assert.throws(()=>remoteUrl(url),undefined,url);
  assert.equal(publicAddress('2001:db8::1'),false);
  assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('valida DNS completo, fixa endereço e revalida cada redirecionamento',async()=>{
  let calls=0;
  const request=async(url,address)=>{calls++;assert.equal(address.address,'93.184.215.14');return {status:200,html:fixture};};
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve:async()=>[{address:'127.0.0.1',family:4}],request}));
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve:async()=>[{address:'93.184.215.14',family:4},{address:'10.0.0.1',family:4}],request}));
  assert.equal(calls,0);
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve,request:async()=>({status:302,location:'http://169.254.169.254/'})}));
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve,request:async()=>({status:302,location:'/loop'})}));
  const page=await fetchRemotePage('http://example.com',{resolve,request:async(url,address)=>{assert.equal(address.address,'93.184.215.14');return url.protocol==='http:'?{status:301,location:'https://example.com/article'}:{status:200,html:fixture};}});
  assert.equal(page.url,'https://example.com/article');
});
test('timeout inclui resolução DNS e resposta remota',async()=>{
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve:()=>new Promise(()=>{}),timeoutMs:20}),/demorou/);
  await assert.rejects(()=>fetchRemotePage('https://example.com',{resolve,request:()=>new Promise(()=>{}),timeoutMs:20}),/demorou/);
});

test('download de imagem revalida DNS/redirects e limita MIME, bytes e timeout', async () => {
  const request = async () => ({ status: 200, bytes: Buffer.from('image'), mimeType: 'image/webp' });
  assert.equal((await fetchRemoteImage('https://example.com/image', { resolve, request })).bytes.toString(), 'image');
  await assert.rejects(fetchRemoteImage('https://example.com/image', { resolve: async () => [{ address: '127.0.0.1', family: 4 }], request }));
  await assert.rejects(fetchRemoteImage('https://example.com/image', { resolve, request: async () => ({ status: 302, location: 'http://169.254.169.254/image' }) }));
  await assert.rejects(fetchRemoteImage('https://example.com/image', { resolve, request, maxBytes: 2 }));
  await assert.rejects(fetchRemoteImage('https://example.com/image', { resolve, request: async () => ({ status: 200, bytes: Buffer.from('svg'), mimeType: 'image/svg+xml' }) }));
  await assert.rejects(fetchRemoteImage('https://example.com/image', { resolve: () => new Promise(() => {}), request, timeoutMs: 20 }), /demorou/);
});

test('transporte de imagem valida MIME real da resposta, limite em streaming e compressão', async () => {
  const server = http.createServer((req,res) => {
    res.setHeader('content-type', req.url === '/html' ? 'text/html' : 'image/webp');
    if (req.url === '/compressed') res.setHeader('content-encoding','gzip');
    res.end(req.url === '/large' ? Buffer.alloc(101) : Buffer.from('image'));
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const get = url => requestImage(new URL(`http://example.com:${server.address().port}${url}`), { address:'127.0.0.1', family:4 }, AbortSignal.timeout(2000),100);
    assert.equal((await get('/')).mimeType,'image/webp');
    for (const url of ['/html','large','/compressed']) await assert.rejects(get(url.startsWith('/') ? url : '/' + url));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('extração conserva origem e prepara somente DRAFT, sem executar scripts ou baixar imagem',async()=>{
  const page=await fetchRemotePage('https://example.com/original',{resolve,request:async()=>({status:200,html:fixture})});
  const article=extractArticle(page.html,'https://example.com/original',page.url);
  assert.equal(article.title,'Ciência na Biosfera');assert.equal(article.status,'DRAFT');
  assert.equal(article.source_url,'https://example.com/original');assert.equal(article.source_name,'Fonte editorial');
  assert.equal(article.original_author,'Autora original');assert.equal(article.cover_credit,'Fotógrafo');
  assert.equal(article.external_image_url,'https://example.com/foto.jpg');assert.equal(article.cover_alt,'Paisagem');
  assert.ok(article.body.includes('Primeiro parágrafo'));assert.ok(!article.body.includes('alert'));
  const semantic=extractArticle('<html><head><title>Título básico</title></head><body><main><p>Texto principal.</p></main></body></html>','https://example.com');
  assert.equal(semantic.title,'Título básico');assert.equal(semantic.source_name,'');assert.equal(semantic.original_author,'');
});
test('transporte limita bytes, tipo, compressão e conserva hostname na conexão fixada',async()=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/large') {res.setHeader('content-type','text/html');res.write('x'.repeat(500));res.end('x'.repeat(500));}
    else if(req.url==='/binary'){res.setHeader('content-type','application/octet-stream');res.end('binary');}
    else if(req.url==='/compressed'){res.setHeader('content-type','text/html');res.setHeader('content-encoding','gzip');res.end('gzip');}
    else {res.setHeader('content-type','text/html');res.end(`<p>${req.headers.host}</p>`);}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const port=server.address().port;
    // Teste isolado do transporte; o acesso público usa obrigatoriamente fetchRemotePage.
    const get=path=>requestPage(new URL(`http://example.com:${port}${path}`),{address:'127.0.0.1',family:4},AbortSignal.timeout(2000),100);
    assert.ok((await get('/')).html.includes('example.com'));
    await assert.rejects(()=>get('/large'));await assert.rejects(()=>get('/binary'));await assert.rejects(()=>get('/compressed'));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
