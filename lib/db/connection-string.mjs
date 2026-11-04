// Keep the current pg TLS guarantees explicit, including hostname verification.
export function secureConnectionString(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL inválida.'); }
  if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    url.searchParams.set('sslmode', 'verify-full');
    return url.href;
  }
  return value;
}
