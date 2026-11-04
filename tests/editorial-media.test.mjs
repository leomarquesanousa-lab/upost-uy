import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';

const stub = code => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return stub('export {}');
  if (specifier === '@/lib/db/pool') return stub('export function getPool(){return globalThis.mediaTest.pool}');
  if (specifier === '@/lib/auth/session') return stub('export async function getUser(){return {id:"12345678-1234-1234-1234-123456789abc",role:"OWNER"}}');
  if (specifier === '@/lib/security/remote-page.mjs') return stub('export async function fetchRemoteImage(){if(globalThis.mediaTest.downloadFails)throw new Error("download failed");return globalThis.mediaTest.remoteImage}');
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && !context.parentURL?.includes('/node_modules/'))) {
    const base = specifier.startsWith('@/') ? new URL('../' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) {
      const url = new URL(base.href + suffix);
      if (existsSync(url)) return next(url.href, context);
    }
  }
  return next(specifier,context);
} });

const { persistEditorialImage, assertEditorialImage, inspectEditorialImage } = await import('../server/services/editorial-media.ts');
const { importEditorialImage } = await import('../server/services/import-editorial-image.ts');
const { POST } = await import('../app/api/editorial/upload/route.ts');
const { saveNews, saveTaxonomy } = await import('../server/services/editorial.ts');
const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#337744' } }).png().toBuffer();
const userId = '12345678-1234-1234-1234-123456789abc';

test('editorial images: R2-before-DB, safe failures, import copy, and ghost-reference rejection', async () => {
  const names = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_ENDPOINT','R2_PUBLIC_URL'];
  const previous = names.map(name => process.env[name]);
  const send = S3Client.prototype.send;
  let state;
  function reset() {
    state = { events: [], objects: new Map(), records: new Map(), audits: [], putFails: false, headFails: false, dbFails: false, commitFails: false, downloadFails: false };
    const client = { async query(sql,values) {
      state.events.push(sql.split(' ')[0]);
      if (sql === 'COMMIT' && state.commitFails) throw new Error('commit acknowledgement lost');
      if (sql.startsWith('INSERT INTO media_assets')) {
        if (state.dbFails) throw new Error('db failed');
        state.records.set(values[1], { id: values[0], mime_type: 'image/webp', size: values[2] });
      }
      if (sql.startsWith('INSERT INTO audit_log')) state.audits.push(JSON.parse(values[2]));
      if (sql.startsWith('SELECT id,size,mime_type')) return { rows: state.records.has(values[0]) ? [state.records.get(values[0])] : [] };
      if (sql.startsWith('SELECT active,photo_url')) return { rows: [{ active:true, photo_url:state.authorPhoto || '' }] };
      if (sql.startsWith('SELECT id,active FROM categories')) return { rows: [{ id:userId, active:true }], rowCount:1 };
      return { rows: [], rowCount:0 };
    }, release() {} };
    state.pool = { connect: async () => client, query: client.query };
    state.remoteImage = { bytes: png, mimeType:'image/png', url:'https://source.example/image.png' };
    globalThis.mediaTest = state;
  }
  const configure = () => Object.assign(process.env, { R2_ACCOUNT_ID:'test',R2_ACCESS_KEY_ID:'test',R2_SECRET_ACCESS_KEY:'test',R2_BUCKET_NAME:'test',R2_ENDPOINT:'https://test.r2.cloudflarestorage.com',R2_PUBLIC_URL:'https://media.example.test' });
  S3Client.prototype.send = async function(command) {
    const kind = command.constructor.name;
    state.events.push(kind);
    if (kind === 'PutObjectCommand') {
      if (state.putFails) throw new Error('private secret');
      state.objects.set(command.input.Key, command.input);
      return {};
    }
    if (kind === 'HeadObjectCommand') {
      if (state.headFails) throw new Error('private secret');
      const object = state.objects.get(command.input.Key);
      if (!object) throw Object.assign(new Error('missing'), { $metadata:{httpStatusCode:404} });
      return { ContentLength:object.Body.length, ContentType:object.ContentType };
    }
    if (kind === 'DeleteObjectCommand') { state.objects.delete(command.input.Key); return {}; }
    assert.fail('Unexpected storage operation: ' + kind);
  };
  const input = { bytes:png,filename:'test.png',mimeType:'image/png' };
  try {
    reset(); for (const name of names) delete process.env[name];
    await assert.rejects(persistEditorialImage(input,userId,{sourceType:'manual'}), /Configure o R2/);
    assert.deepEqual(state.events,[]);
    configure(); reset(); state.putFails = true;
    await assert.rejects(persistEditorialImage(input,userId,{sourceType:'manual'}), /gravar a mídia/);
    assert.equal(state.records.size,0);
    assert.equal(state.events.includes('BEGIN'),false);
    reset(); state.headFails = true;
    await assert.rejects(persistEditorialImage(input,userId,{sourceType:'manual'}), /verificar/);
    assert.equal(state.records.size,0);
    assert.equal(state.objects.size,0);
    reset(); state.dbFails = true;
    await assert.rejects(persistEditorialImage(input,userId,{sourceType:'manual'}), /db failed/);
    assert.equal(state.objects.size,0);
    reset(); state.commitFails = true;
    await assert.rejects(persistEditorialImage(input,userId,{sourceType:'manual'}), /commit acknowledgement/);
    assert.equal(state.objects.size,1, 'Ambiguous COMMIT must never cause deletion of possibly referenced bytes');
    reset();
    const url = await persistEditorialImage(input,userId,{sourceType:'manual'});
    assert.ok(state.events.indexOf('HeadObjectCommand') < state.events.indexOf('BEGIN'));
    assert.deepEqual(Object.keys(state.audits[0]).sort(), ['createdAt','mimeType','objectKey','size','sourceType','storageProvider'].sort());
    assert.equal(state.audits[0].objectKey,url.slice(1));
    assert.equal(state.audits[0].storageProvider,'r2');
    assert.equal((await inspectEditorialImage(url)).usable,true);
    state.objects.delete(url.slice(1));
    await assert.rejects(assertEditorialImage(url,state.pool), /Imagem ausente no R2/);
    assert.equal((await inspectEditorialImage(url)).registered,true);

    reset();
    const imported = await importEditorialImage('https://source.example/image.png',userId);
    assert.equal(state.audits[0].sourceType,'import');
    assert.equal(state.audits[0].sourceHost,'source.example');
    state.downloadFails = true;
    assert.equal((await inspectEditorialImage(imported)).usable,true, 'Stored copy survives source unavailability');
    await assert.rejects(importEditorialImage('https://source.example/image.png',userId));
    assert.equal(state.records.size,1);

    reset();
    const upload = await POST(new Request('http://localhost/api/editorial/upload',{method:'POST',headers:{host:'localhost',origin:'http://localhost','content-type':'image/png','x-file-name':'test.png'},body:png}));
    assert.equal(upload.status,201);
    assert.equal(state.records.has((await upload.json()).url),true);
    reset(); state.putFails = true;
    const failed = await POST(new Request('http://localhost/api/editorial/upload',{method:'POST',headers:{host:'localhost',origin:'http://localhost','content-type':'image/png','x-file-name':'test.png'},body:png}));
    assert.equal(failed.status,503);
    assert.equal(state.records.size,0);
    assert.equal(JSON.stringify(await failed.json()).includes('private secret'),false);

    reset(); state.records.set(url,{id:userId,size:1,mime_type:'image/webp'});
    const form = new FormData();
    for (const [key,value] of Object.entries({ title:'Teste',slug:'teste',body:'Texto de teste',status:'PUBLISHED',author_id:userId,cover_image:url,cover_alt:'Teste' })) form.set(key,value);
    form.append('category_ids',userId);
    await assert.rejects(saveNews(form,userId), /Imagem ausente/);
    assert.equal(state.events.filter(e=>e==='INSERT').length,0);
    form.set('cover_image',''); form.set('cover_alt','');
    form.set('body',`Texto\n\n![imagem][foto]\n\n[foto]: ${url}`);
    await assert.rejects(saveNews(form,userId), /Imagem ausente/);
    form.set('body','Texto'); state.authorPhoto = url;
    await assert.rejects(saveNews(form,userId), /Imagem ausente/);
    const author = new FormData(); author.set('name','Autor teste'); author.set('photo_url',url);
    await assert.rejects(saveTaxonomy('authors',author,userId), /Imagem ausente/);
  } finally {
    S3Client.prototype.send = send;
    names.forEach((name,i)=>{ if (previous[i] === undefined) delete process.env[name]; else process.env[name]=previous[i]; });
    delete globalThis.mediaTest;
  }
});
