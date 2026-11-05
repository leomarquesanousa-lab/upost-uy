import { test, expect } from '@playwright/test';
const bannerHeight = (width: number) => width > 1024 ? 168 : width > 640 ? 150 : 120;

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000', sameSite: 'Lax' }]);
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  // Financial data is real; advertising endpoints remain intercepted to avoid DB writes.
  await context.route('**/api/market', route => route.continue());
  await context.route(/googletagmanager|googlesyndication|google-analytics/, route => route.abort());
});
for (const width of [1440, 1024, 768, 390]) {
  test('premium top with real indicators and no invented campaigns at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const marketResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/market' && response.request().method() === 'GET');
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Secciones principales', exact: true })).toHaveCount(0);
    const ticker = page.locator('[data-market-ticker]');
    const available = (await (await marketResponse).json())?.indicators?.length || 0;
    await expect(ticker.locator('time')).toHaveCount(available * 2, { timeout: 15000 });
    expect(await ticker.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(167, 25, 34)');
    expect((await ticker.boundingBox())!.height).toBe(34);
    await expect(page.locator('[data-home-radio]')).toHaveCount(1);
    const logo = (await page.locator('[data-header-logo]').boundingBox())!;
    expect(Math.abs(logo.x + logo.width / 2 - width / 2)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // Explicit pause is keyboard accessible in addition to hover/focus pause.
    if (available) {
      await ticker.getByRole('button', { name: 'Pausar cotizaciones' }).click();
      await expect(ticker.getByRole('button', { name: 'Reanudar cotizaciones' })).toHaveAttribute('aria-pressed', 'true');
    } else await expect(ticker).toContainText('Indicadores temporalmente no disponibles');
    await page.screenshot({ path: testInfo.outputPath('real-top-' + width + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}

// These fixtures exist only in Playwright routing, never in public assets or the DB.
const delivery = (id: string) => ({ id, receipt: id, image: '/__visual/' + id + '.svg', mobile: '/__visual/mobile-' + id + '.svg', alt: 'Prueba visual — no publicada ' + id, end: null });
async function bannerFixtures(page: import('@playwright/test').Page, advertisement = true) {
  await page.route('**/api/ads/top*', route => route.fulfill({ json: { slides: [delivery('uno'), delivery('dos')], advertisement: advertisement ? delivery('lateral') : null } }));
  await page.route('**/__visual/*.svg', route => {
    const mobile = route.request().url().includes('mobile-');
    const width = mobile ? 420 : route.request().url().includes('lateral') ? 400 : 1100;
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="140"><rect width="100%" height="100%" fill="#f5f1eb"/><path d="M0 0h12v140H0z" fill="#A71922"/><text x="${mobile ? 40 : 90}" y="65" font-family="Georgia" font-size="${mobile ? 24 : 36}" fill="#171717">UPOST.uy</text><text x="${mobile ? 40 : 90}" y="100" font-family="Arial" font-size="14" fill="#626262">PRUEBA VISUAL · NO PUBLICADA</text></svg>` });
  });
}
for (const width of [1440, 1024, 768, 390]) {
  test('banner fixture layout and manual navigation at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await bannerFixtures(page);
    await page.goto('/');
    const top = page.locator('[data-top-banners]');
    await expect(top).toBeVisible();
    const carousel = top.getByRole('region', { name: 'Banners destacados' });
    const advertisement = top.getByRole('complementary', { name: 'Radio en vivo' });
    const left = (await carousel.boundingBox())!, right = (await advertisement.boundingBox())!;
    expect(left.height).toBe(bannerHeight(width));
    expect(right.height).toBe(width > 640 ? left.height : 136);
    if (width > 640) {
      expect(Math.abs(left.y - right.y)).toBeLessThan(1);
      expect(left.width / right.width).toBeCloseTo(7 / 3, 1);
    } else expect(right.y).toBeGreaterThan(left.y + left.height);
    await carousel.getByRole('button', { name: 'Banner siguiente' }).click();
    await expect(carousel.getByRole('button', { name: 'Ver banner 2' })).toHaveAttribute('aria-current', 'true');
    await expect(carousel.getByRole('button', { name: 'Reanudar banners' })).toBeVisible();
    await carousel.getByRole('button', { name: 'Banner anterior' }).click();
    await expect(carousel.getByRole('button', { name: 'Ver banner 1' })).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath('fixture-top-' + width + '.png'), fullPage: true });
  });
}
test('carousel rotates, pauses after interaction, and keeps 70% without the side ad', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await bannerFixtures(page, false);
  await page.goto('/');
  const top = page.locator('[data-top-banners]');
  const carousel = top.getByRole('region', { name: 'Banners destacados' });
  await expect(carousel.getByRole('button', { name: 'Ver banner 2' })).toHaveAttribute('aria-current', 'true', { timeout: 9000 });
  await carousel.getByRole('button', { name: 'Ver banner 1' }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(6500);
  await expect(carousel.getByRole('button', { name: 'Ver banner 1' })).toHaveAttribute('aria-current', 'true');
  await expect(top.getByRole('complementary', { name: 'Radio en vivo' })).toHaveCount(1);
  expect((await carousel.boundingBox())!.width).toBeCloseTo(((await top.boundingBox())!.width - 14) * .7, 0);
});

for (const width of [1440, 1024, 768, 390]) {
  test('radio occupies the 30% column and lower duplicate is absent at ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await bannerFixtures(page, false);
    await page.goto('/');
    const top = page.locator('[data-top-banners]');
    const carousel = top.getByRole('region', { name: 'Banners destacados' });
    await expect(carousel).toBeVisible();
    const frame = (await top.boundingBox())!, left = (await carousel.boundingBox())!;
    expect(left.width).toBeCloseTo(width > 640 ? (frame.width - 14) * .7 : frame.width, 0);
    expect(frame.height).toBe(width > 640 ? bannerHeight(width) : bannerHeight(width) + 14 + 136);
    await expect(page.locator('[data-home-radio]')).toHaveCount(1);
    await expect(page.locator('[data-radio-player]')).toHaveCount(0);
    await expect(page.locator('.upost-home').getByRole('heading', { name: 'Radios en vivo', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-radio-station]')).toHaveCount(1);
    await expect(page.locator('.upost-home .edition-heading')).toHaveCount(0);
    for (const text of ['PERIODISTAS EN RED', 'Noticias que nos conectan.', 'Uruguay y el mundo, con mirada propia.']) {
      await expect(page.locator('.upost-home').getByText(text, { exact: true })).toHaveCount(0);
    }
    const news = (await page.locator('.editorial-grid').boundingBox())!;
    expect(news.y - frame.y - frame.height).toBe(width > 640 ? 20 : 18);
    await expect(top.getByRole('complementary', { name: 'Radio en vivo' })).toHaveCount(1);
    await expect(top.getByText('Publicidad', { exact: true })).toHaveCount(0);
    const image = carousel.locator('[aria-hidden=false] img');
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    const box = (await image.boundingBox())!;
    expect(box.width).toBeCloseTo(left.width, 0);
    expect(box.height).toBe(left.height);
    expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('cover');
    const radioBox = (await top.getByRole('complementary', { name: 'Radio en vivo' }).boundingBox())!;
    if (width > 640) {
      expect(left.width / radioBox.width).toBeCloseTo(7 / 3, 1);
      expect(left.y).toBe(radioBox.y);
      expect(radioBox.height).toBe(left.height);
    } else {
      expect(radioBox.width).toBe(frame.width);
      expect(radioBox.y).toBe(left.y + left.height + 14);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath('reserved-white-' + width + '.png'), fullPage: true });
  });
}
test('reduced motion disables ticker animation and automatic banner rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bannerFixtures(page);
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Banners destacados' });
  await expect(carousel.getByRole('button', { name: 'Ver banner 1' })).toHaveAttribute('aria-current', 'true');
  await page.waitForTimeout(6500);
  await expect(carousel.getByRole('button', { name: 'Ver banner 1' })).toHaveAttribute('aria-current', 'true');
  const animated = await page.locator('[data-market-ticker]').evaluate(node => [...node.querySelectorAll('*')].some(child => getComputedStyle(child).animationName !== 'none'));
  expect(animated).toBe(false);
});
test('unavailable financial data leaves the homepage and navigation usable', async ({ page }) => {
  await page.route('**/api/market', route => route.fulfill({ json: { indicators: [] } }));
  await page.goto('/');
  await expect(page.locator('[data-market-ticker]')).toContainText('Indicadores temporalmente no disponibles');
  await expect(page.locator('.editorial-grid h2').first()).toBeVisible();
  const stories = await page.locator('.editorial-grid .news-card h2 a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(stories.length).toBeGreaterThan(0);
  expect(new Set(stories).size).toBe(stories.length);
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Explorá UPOST' })).toBeVisible();
});
test('newly activated banners appear when returning from the admin tab', async ({ page }) => {
  await bannerFixtures(page, false);
  let available = false;
  await page.route('**/api/ads/top*', route => route.fulfill({ json: { slides: available ? [delivery('uno')] : [], advertisement: null } }));
  const initial = page.waitForResponse(response => new URL(response.url()).pathname === '/api/ads/top');
  await page.goto('/');
  await (await initial).finished();
  await expect(page.locator('[data-home-radio]')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Banners destacados' })).toHaveCount(0);
  available = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('region', { name: 'Banners destacados' })).toBeVisible();
  await expect(page.locator('[data-home-radio]')).toHaveCount(1);
});
