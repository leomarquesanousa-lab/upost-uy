import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Article = { title: string; summary: string; sourceName: string; url: string; publishedAt: string; category: { name: string; slug: string } };
const { articles } = JSON.parse(readFileSync('scripts/initial-news.json', 'utf8')) as { articles: Article[] };
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'upost_cookie_consent', value: encodeURIComponent(JSON.stringify({ analytics: false, advertising: false })), url: 'http://localhost:3000', sameSite: 'Lax' }]);
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await context.route(/googletagmanager|googlesyndication|google-analytics/, route => route.abort());
});
for (const width of [1440, 1024, 768, 390]) {
  test('five imported stories appear once with real photographs at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    const cards = page.locator('.editorial-grid .news-card');
    await expect(cards).toHaveCount(5);
    for (const item of articles) {
      const card = cards.filter({ has: page.getByRole('heading', { name: item.title, exact: true }) });
      await expect(card).toHaveCount(1);
      await expect(card.getByRole('heading')).toBeVisible();
      await expect(card.locator('.news-card-copy > p')).toHaveText(item.summary);
      await expect(card.locator('small')).toContainText(item.sourceName);
      await expect(card.getByRole('link', { name: item.category.name, exact: true })).toBeVisible();
      await expect(card.locator('time')).toHaveAttribute('datetime', item.publishedAt);
      const image = card.locator('img');
      await expect(image).toHaveCount(1);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('cover');
      expect(await image.locator('..').evaluate(node => getComputedStyle(node).borderRadius)).toBe('14px');
    }
    await expect(cards.locator('img')).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) expect(await page.locator('.editorial-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(3);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('home-' + width + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test('all five internal story pages preserve the source link and short summary', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const item of articles) {
    const href = await page.locator('.news-card h2').getByRole('link', { name: item.title, exact: true }).getAttribute('href');
    expect(href).toBeTruthy();
    const story = await page.context().newPage();
    try {
      const response = await story.goto(href!);
      expect(response?.status()).toBe(200);
      await expect(story.getByRole('heading', { level: 1 })).toHaveText(item.title);
      await expect(story.locator('.article-body')).toContainText(item.summary);
      expect(await story.locator('a').evaluateAll((nodes, url) => nodes.some(node => node.getAttribute('href') === url), item.url)).toBe(true);
      const cover = story.locator('.article-cover');
      await expect(cover).toHaveCount(1);
      await expect.poll(() => cover.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      const imagePath = await cover.getAttribute('src');
      const imageResponse = await story.request.get(imagePath!);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()['content-type']).toContain('image/webp');
      expect((await imageResponse.body()).length).toBeGreaterThan(1000);
      const photos = JSON.parse(readFileSync('docs/UPOST-FOTOS-RESULTADO.json', 'utf8')) as {results: {title:string;credit:string}[]};
      const credit = photos.results.find(photo => photo.title === item.title)?.credit;
      if (credit) await expect(story.locator('.article-page figcaption')).toContainText(credit);
      await story.locator('.article-page').screenshot({ path: testInfo.outputPath('article-' + articles.indexOf(item) + '.png') });
    } finally { await story.close(); }
  }
});

for (const width of [1440, 1024, 768, 390]) {
  test('article reading layout at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.locator('.news-card h2').getByRole('link', { name: articles[0].title, exact: true }).click();
    const article = page.locator('.article-page');
    const body = article.locator('.article-body');
    const cover = article.locator('.article-cover');
    await expect(article.getByRole('heading', { level: 1 })).toHaveText(articles[0].title);
    await expect(body).toContainText(articles[0].summary);
    await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const layout = await article.evaluate(node => {
      const body = node.querySelector('.article-body')!;
      const image = node.querySelector<HTMLImageElement>('.article-cover')!;
      const heading = node.querySelector('h1')!;
      const share = node.querySelector('.share-links')!;
      const rect = node.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const style = getComputedStyle(body);
      return {
        width: rect.width, padding: parseFloat(getComputedStyle(node).paddingLeft),
        bodyWidth: bodyRect.width, left: bodyRect.left, right: bodyRect.right,
        font: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight),
        imageRatio: imageRect.width / imageRect.height, naturalRatio: image.naturalWidth / image.naturalHeight,
        shareBeforeImage: share.getBoundingClientRect().bottom < imageRect.top,
        titleClipped: heading.scrollHeight > heading.clientHeight + 1,
      };
    });
    expect(layout.width).toBeLessThanOrEqual(1160);
    expect(layout.bodyWidth).toBeLessThanOrEqual(720);
    expect(layout.left).toBeGreaterThanOrEqual(16);
    expect(layout.right).toBeLessThanOrEqual(width - 16);
    expect(layout.font).toBe(width < 641 ? 18 : 20);
    expect(layout.lineHeight / layout.font).toBeCloseTo(1.75);
    expect(layout.imageRatio).toBeCloseTo(layout.naturalRatio, 2);
    expect(layout.shareBeforeImage).toBe(true);
    expect(layout.titleClipped).toBe(false);
    if (width > 640) expect(layout.padding).toBeGreaterThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath('reading-' + width + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}
