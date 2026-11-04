import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderBody, renderedImagePaths } from '../lib/editorial/content.mjs';
import { normalizeImage, MAX_IMAGE_BYTES } from '../lib/editorial/image.mjs';

test('Markdown preserva formatação e remove HTML ativo, atributos e URLs perigosas', () => {
  const html = renderBody('## Título\n\n**negrito** e *itálico*\n\n- lista\n\n> citação\n\n[link](https://example.com)\n\n<script>alert(1)</script><iframe src="https://evil.test"></iframe><img src="x" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">ataque</a><svg onload="alert(1)"></svg>');
  for (const tag of ['h2','strong','em','ul','blockquote']) assert.ok(html.includes(`<${tag}>`));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(!/script|iframe|onerror|onclick|javascript:|<svg/.test(html));
});
test('imagens do corpo aceitam apenas referências ao storage local', () => {
  const html = renderBody('![local](/media/12345678-1234-1234-1234-123456789abc.webp) ![externa](https://evil.test/pixel.png) ![data](data:image/svg+xml;base64,abc)');
  assert.equal((html.match(/<img/g) || []).length,1);
  assert.ok(!html.includes('evil.test'));
});

test('existência deve ser verificada também para imagens Markdown por referência e HTML permitido', () => {
  const url = '/media/12345678-1234-1234-1234-123456789abc.webp';
  assert.deepEqual(renderedImagePaths(`![foto][ref]\n\n[ref]: ${url}\n\n<img src="${url}">\n![externa](https://example.com/image.png)`), [url]);
});
test('upload valida bytes reais, extensão, MIME, tamanho e converte imagem para WebP', async () => {
  const png = await sharp({ create:{width:20,height:20,channels:3,background:'#337744'} }).png().toBuffer();
  const converted = await normalizeImage(png,'foto.png','image/png');
  assert.equal((await sharp(converted).metadata()).format,'webp');
  await assert.rejects(()=>normalizeImage(png,'foto.exe','image/png'));
  await assert.rejects(()=>normalizeImage(png,'foto.jpg','image/jpeg'));
  await assert.rejects(()=>normalizeImage(Buffer.from('<script>evil</script>'),'foto.png','image/png'));
  await assert.rejects(()=>normalizeImage(Buffer.alloc(MAX_IMAGE_BYTES+1),'foto.png','image/png'));
  await assert.rejects(()=>normalizeImage(Buffer.from('<svg></svg>'),'foto.svg','image/svg+xml'));
});
