import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappNumber } from '../lib/whatsapp.mjs';

test('WhatsApp normalizes international numbers without inventing country codes', () => {
  assert.equal(whatsappNumber('+55 (11) 99999-9999'), '5511999999999');
  assert.equal(whatsappNumber('+44 20 7946 0958'), '442079460958');
  assert.equal(whatsappNumber('55.11.99999.9999'), '5511999999999');
  for (const value of ['', undefined, 'abc', '123', '0123456789', '1234567890123456']) assert.equal(whatsappNumber(value), '');
});
