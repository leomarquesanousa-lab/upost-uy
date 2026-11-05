import { test, expect } from '@playwright/test';

// Real inventory/media, no mocked photographs or campaign writes.
for (const width of [1440, 1024, 768, 390]) {
  test(`Uruguay photographs, crossfade and radio alignment at ${width}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000' }]);
    await page.route('**/api/ads/impression', route => route.fulfill({ json: { ok: true } }));
    await page.goto('/');
    const carousel = page.getByRole('region', { name: 'Banners destacados' });
    const slides = carousel.locator('[aria-roledescription="diapositiva"]');
    await expect(slides).toHaveCount(3);
    await expect.poll(() => slides.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const alts = await slides.locator('img').evaluateAll(images => images.map(image => image.getAttribute('alt')));
    expect(alts[0]).toContain('Punta del Este'); expect(alts[1]).toContain('Colonia del Sacramento'); expect(alts[2]).toContain('Termas de Salto');
    const left = (await carousel.boundingBox())!;
    const radio = (await page.locator('[data-home-radio]').boundingBox())!;
    expect(left.height).toBe(width > 1024 ? 168 : width > 640 ? 150 : 120);
    if (width > 640) { expect(Math.abs(radio.y - left.y)).toBeLessThan(1); expect(Math.abs(radio.height - left.height)).toBeLessThan(1); }
    else expect(radio.y).toBeGreaterThan(left.y + left.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // Manual navigation pauses rotation; both images must overlap during the fade,
    // with no translation or change in the carousel's horizontal position.
    await page.waitForTimeout(700);
    for (let index = 0; index < 3; index++) {
      if (index) {
        await carousel.getByRole('button', { name: `Ver banner ${index + 1}`, exact: true }).click();
        await page.waitForTimeout(120);
        const during = await slides.evaluateAll(nodes => nodes.map(node => ({ opacity: Number(getComputedStyle(node).opacity), transform: getComputedStyle(node).transform })));
        expect(during.filter(s => s.opacity > 0 && s.opacity < 1)).toHaveLength(2);
        expect(during.every(s => s.transform === 'none')).toBe(true);
        expect((await carousel.boundingBox())!.x).toBe(left.x);
        await page.waitForTimeout(650);
      }
      await expect(slides.nth(index)).toHaveAttribute('aria-hidden', 'false');
      await expect(slides.nth(index).locator('a').last()).toHaveAttribute('href', /^https:\/\/commons.wikimedia.org\/wiki\/File:/);
      const credit = (await slides.nth(index).locator('a').last().boundingBox())!;
      const controls = (await carousel.getByRole('button', { name: 'Ver banner 1', exact: true }).boundingBox())!;
      expect(credit.x + credit.width).toBeLessThan(controls.x - 3);
      const dimensions = await slides.nth(index).locator('img').evaluate(img => ({ width: (img as HTMLImageElement).naturalWidth, height: (img as HTMLImageElement).naturalHeight, fit: getComputedStyle(img).objectFit }));
      expect(dimensions).toEqual({ width: width <= 640 ? 900 : 1720, height: width <= 640 ? 300 : 336, fit: 'cover' });
      await page.locator('[data-top-banners]').screenshot({ path: testInfo.outputPath(`uruguay-${width}-${index}.png`) });
    }
    await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await carousel.getByRole('button', { name: 'Ver banner 1', exact: true }).click();
    await expect(slides.nth(0)).toHaveCSS('transition-duration', '0s');
  });
}
