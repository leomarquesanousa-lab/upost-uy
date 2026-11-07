import test from 'node:test';
import assert from 'node:assert/strict';
import { additionalRadios, withAdditionalRadios } from '../lib/radio-stations.mjs';
test('radio presets preserve the main station and registered overrides without duplicates', () => {
  const main = { id: 'main', name: 'Radio Mix Artigas', url: 'https://www.radiomixartigas.com/', active: true };
  assert.equal(withAdditionalRadios([main]).length, 3);
  assert.equal(withAdditionalRadios([main])[0], main);
  const override = { ...additionalRadios[0], active: false, stream_url: 'https://example.invalid/updated' };
  const merged = withAdditionalRadios([main, override]);
  assert.equal(merged.length, 3);
  assert.equal(merged[1], override);
  assert.equal(merged.filter(r => r.active).length, 2);
  assert.equal(withAdditionalRadios(merged).length, 3);
});
