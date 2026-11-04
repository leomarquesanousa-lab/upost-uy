import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash } from '../lib/security/password.mjs';
test('scrypt utiliza salt aleatório e rejeita senha incorreta e hash inválido', async () => {
  const password = 'senha-exclusiva-do-teste';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.ok(first !== second);
  assert.ok(!first.includes(password));
  assert.ok(await verifyPassword(password, first));
  assert.ok(!await verifyPassword('incorreta', first));
  assert.ok(!await verifyPassword(password, 'invalido'));
});
test('token de sessão é representado por hash SHA-256', () => {
  assert.match(tokenHash('token-apenas-de-teste'), /^[a-f0-9]{64}$/);
  assert.equal(tokenHash('a'), tokenHash('a'));
  assert.notEqual(tokenHash('a'), tokenHash('b'));
});
