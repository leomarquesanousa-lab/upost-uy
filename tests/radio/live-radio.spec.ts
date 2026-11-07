import { test, expect } from '@playwright/test';
const stream = 'https://radio.bachistreaming.com/radio-mix-artigas';
declare global { interface Window { __radioAudio?: Element; } }
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000', sameSite: 'Lax' }]);
  // Leave only the real radio stream unmocked. No ad impressions or deliveries.
  await context.route('**/api/**', route => route.fulfill({ json: null }));
  await context.route(/googletagmanager|googlesyndication|google-analytics/, route => route.abort());
});
for (const width of [1440, 390]) {
  test('real AAC play/pause, volume and persistent navigation at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    let streamRequests = 0;
    page.on('request', request => { if (request.url().startsWith(stream)) streamRequests++; });
    await page.goto('/');
    const audio = page.locator('[data-radio-audio]');
    const player = page.locator('[data-radio-player]');
    const homePlayer = page.locator('[data-home-radio]');
    await expect(homePlayer).toContainText('Radio Mix Artigas');
    await expect(player).toHaveCount(1);
    await expect(page.locator('[data-radio-station]')).toHaveCount(1);
    await expect(audio).toHaveCount(1);
    expect(await audio.evaluate((node: HTMLAudioElement) => node.paused && !node.getAttribute('src'))).toBe(true);
    expect(streamRequests).toBe(0);
    const card = page.locator('[data-radio-station]').filter({ has: page.getByRole('heading', { name: 'Radio Mix Artigas', exact: true }) });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Escuchar Radio Mix Artigas', exact: true }).click();
    await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => !node.paused && node.currentTime > 1 && node.readyState >= 2), { timeout: 25000 }).toBe(true);
    await expect(homePlayer.getByRole('status')).toHaveText('Escuchando en vivo');
    expect(await audio.evaluate((node: HTMLAudioElement) => node.currentSrc)).toBe(stream);
    const volume = homePlayer.getByRole('slider', { name: 'Volumen de la radio' });
    await volume.focus(); await volume.press('Home'); await volume.press('ArrowRight');
    await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.volume)).toBeCloseTo(.01);
    await volume.press('End');
    await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.volume)).toBe(1);
    await audio.evaluate(node => window.__radioAudio = node);
    const before = await audio.evaluate((node: HTMLAudioElement) => node.currentTime);
    await page.screenshot({ path: testInfo.outputPath('home-radio-' + width + '.png'), fullPage: true, animations: 'disabled' });
    await page.locator('.news-card h2 a').first().click();
    await expect(page).toHaveURL(/\/noticias\//);
    expect(await audio.evaluate(node => node === window.__radioAudio)).toBe(true);
    await expect.poll(() => audio.evaluate((node: HTMLAudioElement, time: number) => !node.paused && node.currentTime > time, before)).toBe(true);
    await page.locator('[data-upost-header]').getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await page.getByRole('dialog', { name: 'Explorá UPOST' }).getByRole('link', { name: 'Radios en vivo', exact: true }).click();
    await expect(page).toHaveURL(/\/radios$/);
    expect(await audio.evaluate(node => node === window.__radioAudio)).toBe(true);
    await expect(page.locator('[data-radio-station]').filter({hasText:'Radio Mix Artigas'})).toContainText('Radio en vivo');
    await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => !node.paused)).toBe(true);
    await player.getByRole('button', { name: 'Pausar radio', exact: true }).click();
    expect(await audio.evaluate((node: HTMLAudioElement) => node.paused && !node.getAttribute('src'))).toBe(true);
    await expect(player.getByRole('status')).toHaveText('Lista para escuchar');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath('radio-' + width + '.png'), fullPage: true, animations: 'disabled' });
    console.log(JSON.stringify({ width, stream, requests: streamRequests, realPlayback: true, sameAudioAfterNavigation: true, noAutoplay: true }));
  });
}
test('unavailable stream shows a recoverable connection error without autoplay', async ({ page }) => {
  await page.route(stream + '**', route => route.abort('failed'));
  await page.goto('/radios');
  const player = page.locator('[data-radio-player]');
  await player.getByRole('button', { name: 'Escuchar radio', exact: true }).click();
  await expect(player.getByRole('status')).toHaveText('No se pudo conectar. Intentá nuevamente.', { timeout: 25000 });
  await expect(player.getByRole('button', { name: 'Escuchar radio', exact: true })).toBeEnabled();
  expect(await page.locator('[data-radio-audio]').evaluate((node: HTMLAudioElement) => node.paused)).toBe(true);
});

test('three stations share one audio and changing selection stops playback', async ({ page }) => {
  await page.goto('/');
  const audio=page.locator('[data-radio-audio]'), card=page.locator('[data-home-radio]');
  const choices=card.getByRole('group',{name:'Seleccionar radio'});
  await expect(choices.getByRole('button')).toHaveCount(3);
  for(const [choice,name,url] of [
    ['Avenida','Avenida Ciudadana','https://stm15.painelcast.com:7362/stream'],
    ['Encuentro Minas','Radio Encuentro Minas','https://servidor31-1.brlogic.com:7034/live?source=website'],
    ['Mix Artigas','Radio Mix Artigas',stream],
  ]) {
    await choices.getByRole('button',{name:choice,exact:true}).click();
    expect(await audio.evaluate((e:HTMLAudioElement)=>e.paused&&!e.getAttribute('src'))).toBe(true);
    await expect(card.getByRole('heading',{name,exact:true})).toBeVisible();
    await card.getByRole('button',{name:'Escuchar '+name,exact:true}).click();
    await expect.poll(()=>audio.evaluate((e:HTMLAudioElement)=>!e.paused&&e.currentTime>0&&e.readyState>=2),{timeout:25000}).toBe(true);
    expect(await audio.evaluate((e:HTMLAudioElement)=>e.currentSrc)).toBe(url);
    await expect(audio).toHaveCount(1);
  }
  await card.getByRole('button',{name:'Pausar Radio Mix Artigas',exact:true}).click();
  expect(await audio.evaluate((e:HTMLAudioElement)=>e.paused)).toBe(true);
});
