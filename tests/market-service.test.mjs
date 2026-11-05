import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
  if (specifier === '@/lib/market.mjs') return next(new URL('../lib/market.mjs', import.meta.url).href, context);
  return next(specifier, context);
} });
test('market service coalesces concurrent calls, caches failures and isolates each endpoint', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    if (url.includes('/eur/')) return new Response('', { status: 503, headers: { 'Retry-After': '120' } });
    const currency = /\/(usd|brl|ars)\/quote/.exec(url)?.[1];
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const data = currency ? { currency, bank: 'BROU', buy: 1, sell: 2, as_of: now.toISOString() } : [{ series: url.includes('/ui') ? 'ui' : 'annual_12m_total_country', value: 1, date: today }];
    return Response.json({ data });
  };
  try {
    const { marketSnapshot } = await import('../server/services/market.ts');
    const [a, b] = await Promise.all([marketSnapshot(), marketSnapshot()]);
    assert.equal(calls, 6);
    assert.equal(a.length, 5);
    assert.deepEqual(a, b);
    assert.equal(a.some(item => item.id === 'eur'), false);
    await marketSnapshot();
    assert.equal(calls, 6);
  } finally { globalThis.fetch = original; }
});
