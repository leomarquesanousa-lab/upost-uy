import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'pg-connection-string';
import { secureConnectionString } from '../lib/db/connection-string.mjs';

test('deprecated SSL modes preserve TLS certificate and hostname verification', () => {
  for (const mode of ['prefer', 'require', 'verify-ca']) {
    const result = secureConnectionString(`postgresql://user:p%40ss@db.example/test?sslmode=${mode}&channel_binding=require`);
    const config = parse(result);
    assert.equal(config.sslmode, 'verify-full');
    assert.notEqual(config.ssl.rejectUnauthorized, false);
    assert.equal(config.ssl.checkServerIdentity, undefined);
    assert.equal(config.password, 'p@ss');
    assert.equal(config.channel_binding, 'require');
  }
});

test('explicit full verification and local connections remain unchanged', () => {
  for (const url of ['postgresql://localhost/test', 'postgresql://localhost/test?sslmode=disable', 'postgresql://db.example/test?sslmode=verify-full']) {
    assert.equal(secureConnectionString(url), url);
  }
  assert.throws(() => secureConnectionString('secret-invalid-url'), error => !error.message.includes('secret-invalid-url'));
});
