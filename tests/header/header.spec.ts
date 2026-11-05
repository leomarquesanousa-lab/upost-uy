import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000', sameSite: 'Lax' }]);
  // Client-side ads can record deliveries; intercept all APIs to keep this suite read-only.
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await context.route(/googletagmanager|googlesyndication|google-analytics/, route => route.abort());
});

for (const width of [1440, 1024, 768, 390, 360]) {
  test('header composition at ' + width + 'px', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const header = page.locator('[data-upost-header]');
    const image = header.locator('[data-header-logo] img');
    await expect(header).toBeVisible();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    const bounds = await image.boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThanOrEqual(.5);
    expect(bounds!.height).toBeLessThanOrEqual(width < 768 ? 42 : 60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const controls = await header.locator('button:visible, [data-header-logo], a[href="/admin"]:visible').all();
    const logo = (await header.locator('[data-header-logo]').boundingBox())!;
    for (const control of controls) {
      if (await control.getAttribute('data-header-logo') !== null) continue;
      const box = await control.boundingBox();
      if (!box || box.y >= logo.y + logo.height) continue;
      expect(box.x + box.width <= logo.x || box.x >= logo.x + logo.width).toBe(true);
    }
    await header.screenshot({ path: testInfo.outputPath('header-' + width + '.png'), animations: 'disabled' });
    const trigger = header.getByRole('button', { name: 'Abrir menú', exact: true });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Explorá UPOST' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Administración', exact: true })).toBeVisible();
    expect(await menu.getByRole('link').count()).toBe(17);
    expect(await menu.getByRole('link').evaluateAll(links => new Set(links.map(link => link.getAttribute('href'))).size)).toBe(17);
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath('navigation-' + width + '.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await header.getByRole('button', { name: 'Buscar noticias', exact: true }).click();
    const search = page.getByRole('dialog', { name: 'Buscar en UPOST' });
    const input = search.getByRole('searchbox');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('placeholder', 'Buscar noticias...');
    const searchBox = (await search.boundingBox())!;
    expect(searchBox.x).toBeGreaterThanOrEqual(0);
    expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(width);
    expect(searchBox.y).toBeGreaterThanOrEqual(logo.y + logo.height);
    await input.fill('Montevideo');
    await expect(search.getByRole('button', { name: 'Limpiar búsqueda' })).toBeVisible();
    await search.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(search.getByRole('button', { name: 'Limpiar búsqueda' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('search-' + width + '.png'), animations: 'disabled' });
    await search.getByRole('button', { name: 'Cerrar búsqueda' }).click();
    await expect(search).not.toBeVisible();
    await expect(header.getByRole('button', { name: 'Buscar noticias', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('menu traps keyboard focus, closes on link selection, and search submits the existing query', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.locator('[data-upost-header]').getByRole('button', { name: 'Abrir menú' }).click();
  const menu = page.getByRole('dialog', { name: 'Explorá UPOST' });
  for (let index = 0; index < 22; index++) {
    await page.keyboard.press('Tab');
    expect(await menu.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await menu.getByRole('link', { name: 'Uruguay', exact: true }).click();
  await expect(page).toHaveURL(/\/uruguay$/);
  await expect(menu).not.toBeVisible();
  await page.locator('[data-upost-header]').getByRole('button', { name: 'Buscar noticias' }).click();
  const search = page.getByRole('dialog', { name: 'Buscar en UPOST' });
  await search.getByRole('searchbox').fill('Montevideo');
  await search.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/\/busca\?q=Montevideo$/);
  await expect(page.locator('.news-grid .news-card')).not.toHaveCount(0);
});

test('panels close outside, restore focus, and keep the close control reachable on short mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const header = page.locator('[data-upost-header]');
  const trigger = header.getByRole('button', { name: 'Abrir menú', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Explorá UPOST' });
  await expect(menu).toBeVisible();
  await menu.evaluate(node => node.scrollTop = node.scrollHeight);
  const close = menu.getByRole('button', { name: 'Cerrar menú' });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await header.getByRole('button', { name: 'Buscar noticias', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Buscar en UPOST' });
  await expect(search).toBeVisible();
  await page.mouse.click(4, 110);
  await expect(search).not.toBeVisible();
  await expect(header.getByRole('button', { name: 'Buscar noticias', exact: true })).toBeFocused();
});

test('switching panels leaves just one modal and Escape restores the latest trigger', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('[data-upost-header]');
  await header.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  // Exercise the shared transition handler without clicking through a modal backdrop.
  await header.getByRole('button', { name: 'Buscar noticias', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
  const search = page.getByRole('dialog', { name: 'Buscar en UPOST' });
  await expect(search).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await expect(search.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).not.toBeVisible();
  await expect(header.getByRole('button', { name: 'Buscar noticias', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('reduced motion removes panel animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Explorá UPOST' });
  expect(await menu.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
});
