import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const key = await scrypt(password, parts[1], 64, options);
  return timingSafeEqual(key, Buffer.from(parts[2], 'hex'));
}
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
