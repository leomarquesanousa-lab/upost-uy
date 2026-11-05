import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarket } from '../lib/market.mjs';
const now = new Date('2026-11-04T12:00:00Z');
test('market: BROU quotes preserve buy/sell, source date and safe attribution', () => {
  const result = normalizeMarket('usd', { data: { currency: 'usd', bank: 'BROU', buy: 39.6, sell: 41, as_of: '2026-11-04T06:01:36Z' }, meta: { attribution: { url: 'https://untrusted.test/' } } }, now);
  assert.equal(result.value, 'Compra $ 39,60 / Venta $ 41,00');
  assert.equal(result.asOf, '2026-11-04T06:01:36Z');
  assert.equal(result.sourceUrl, 'https://datosuruguay.com/dolar');
  assert.equal(normalizeMarket('usd', { data: { currency: 'usd', bank: 'BROU', buy: null, sell: '', as_of: now.toISOString() } }, now), null);
});
test('market: UI uses the effective day, not a future published value', () => {
  const result = normalizeMarket('ui', { data: [{ series: 'ui', date: '2026-11-05', value: 8 }, { series: 'ui', date: '2026-11-04', value: 6.6885 }] }, now);
  assert.equal(result.value, '$ 6,6885');
  assert.equal(result.asOf, '2026-11-04');
});
test('market: IPC uses the national annual percentage and keeps the period explicit', () => {
  const result = normalizeMarket('ipc', { data: [{ series: 'index_total_country', date: '2026-09-30', value: 119 }, { series: 'annual_12m_montevideo', date: '2026-09-30', value: 9 }, { series: 'annual_12m_total_country', date: '2026-09-30', value: 4.676 }] }, now);
  assert.equal(result.value, '+4,68 %');
  assert.equal(result.asOf, '2026-09-30');
  assert.equal(normalizeMarket('ipc', { data: [] }, now), null);
});
