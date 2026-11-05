import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Chromium headless hides scrollbars by default, masking the original bug.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar'] } });
const photo = JSON.parse(readFileSync('docs/UPOST-FOTOS-RESULTADO.json', 'utf8')).results[0].path as string;
const selectors = ['[data-header-row]', '[data-header-logo]', 'main', '[data-top-banners]', '.editorial-grid', '.editorial-grid .news-card'];
type Frame = { x: number; width: number }[];
declare global { interface Window { __layoutFrames: Frame[]; __sampleLayout: boolean; } }

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000', sameSite: 'Lax' }]);
  await context.route('**/api/**', route => route.fulfill({ json: null }));
  await context.route('**/api/ads/top*', route => route.fulfill({ json: { slides: [{ id: 'layout-test', receipt: 'layout-test', image: photo, mobile: '', alt: 'Verificación de estabilidad', end: null, linked: false }], advertisement: null } }));
  await context.route(/googletagmanager|googlesyndication|google-analytics/, route => route.abort());
});

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(list => list.map(selector => {
    const rect = document.querySelector(selector)!.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  }), selectors);
}

for (const width of [1440, 1024, 390, 360]) {
  test('no horizontal movement across repeated panels and scrolling at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.addStyleTag({ content: '::-webkit-scrollbar { width:17px; height:17px; }' });
    await expect(page.locator('[data-top-banners]')).toBeVisible();
    expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(0);
    const baseline = await measure(page);
    await page.evaluate(list => {
      window.__layoutFrames = []; window.__sampleLayout = true;
      const sample = () => {
        window.__layoutFrames.push(list.map(selector => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, width: r.width }; }));
        if (window.__sampleLayout) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, selectors);
    const header = page.locator('[data-upost-header]');
    for (const scroll of [0, 420]) {
      await page.evaluate(y => scrollTo(0, y), scroll);
      for (let repeat = 0; repeat < 2; repeat++) {
        for (const name of ['Abrir menú', 'Buscar noticias']) {
          const trigger = header.getByRole('button', { name, exact: true });
          // Keep the scrolled page at its existing position while testing the handler.
          await trigger.evaluate((button: HTMLButtonElement) => button.click());
          const dialog = page.locator('dialog[open]');
          await expect(dialog).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
          expect(await measure(page)).toEqual(baseline);
          await page.keyboard.press('Escape');
          await expect(page.locator('dialog[open]')).toHaveCount(0);
          expect(await measure(page)).toEqual(baseline);
        }
      }
      await header.getByRole('button', { name: 'Abrir menú', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
      await expect(page.locator('#upost-navigation-panel')).toBeVisible();
      await header.getByRole('button', { name: 'Buscar noticias', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
      await expect(page.locator('#upost-search-panel')).toBeVisible();
      await expect(page.locator('dialog[open]')).toHaveCount(1);
      expect(await measure(page)).toEqual(baseline);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    }
    const frames = await page.evaluate(() => { window.__sampleLayout = false; return window.__layoutFrames; });
    expect(frames.length).toBeGreaterThan(20);
    const maxDelta = Math.max(...frames.flatMap(frame => frame.flatMap((box, i) => [Math.abs(box.x - baseline[i].x), Math.abs(box.width - baseline[i].width)])));
    expect(maxDelta).toBeLessThanOrEqual(.1);
    expect(await page.evaluate(() => document.body.style.paddingRight)).toBe('');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    expect(await page.evaluate(() => document.documentElement.style.scrollbarGutter)).toBe('');
    console.log(JSON.stringify({ width, sampledFrames: frames.length, maxHorizontalDelta: maxDelta }));
    await testInfo.attach('horizontal-positions', { body: JSON.stringify({ width, baseline, frames: frames.length, maxDelta }, null, 2), contentType: 'application/json' });
  });
}

test('measured fallback preserves existing body padding and restores inline styles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { scrollbar-gutter:auto !important; } body { padding-right:11px; } ::-webkit-scrollbar { width:23px; }' });
  await expect(page.locator('[data-top-banners]')).toBeVisible();
  const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
  expect(gutter).toBeGreaterThan(0);
  const before = await measure(page);
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect.poll(() => page.evaluate(() => parseFloat(document.body.style.paddingRight))).toBe(11 + gutter);
  expect(await measure(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await measure(page)).toEqual(before);
  expect(await page.evaluate(() => document.body.style.paddingRight)).toBe('');
  expect(await page.evaluate(() => getComputedStyle(document.body).paddingRight)).toBe('11px');
});
