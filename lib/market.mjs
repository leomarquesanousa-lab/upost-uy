export const marketEndpoints = [
  ...['usd', 'eur', 'brl', 'ars'].map(currency => ({ id: currency, path: `exchange-rates/${currency}/quote`, seconds: 600 })),
  { id: 'ui', path: 'indexed-units/ui?limit=10', seconds: 3600 },
  { id: 'ipc', path: 'inflation?limit=2', seconds: 21600 },
];
const labels = { usd: 'Dólar BROU', eur: 'Euro BROU', brl: 'Real BROU', ars: 'Peso argentino BROU', ui: 'Unidad Indexada', ipc: 'IPC · 12 meses' };
const pages = { usd: 'dolar', eur: 'euro', brl: 'real', ars: 'peso-argentino', ui: 'ui', ipc: 'inflacion' };
const number = (value, digits = 2) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
function reference(value, time = false) {
  const date = new Date(time ? value : `${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-UY', { timeZone: 'America/Montevideo', day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}) }).format(date);
}
export function normalizeMarket(id, payload, now = new Date()) {
  if (!labels[id] || !payload?.data) return null;
  let value, asOf, ref;
  if (['usd', 'eur', 'brl', 'ars'].includes(id)) {
    const data = payload.data;
    if (data.currency !== id || data.bank !== 'BROU' || typeof data.as_of !== 'string' || !Number.isFinite(Date.parse(data.as_of)) || Date.parse(data.as_of) > now.getTime() + 600000) return null;
    const parts = [];
    if (finite(data.buy) && data.buy > 0) parts.push(`Compra $ ${number(data.buy)}`);
    if (finite(data.sell) && data.sell > 0) parts.push(`Venta $ ${number(data.sell)}`);
    if (!parts.length) return null;
    value = parts.join(' / '); asOf = data.as_of; ref = reference(asOf, true);
  } else {
    if (!Array.isArray(payload.data)) return null;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const series = id === 'ui' ? 'ui' : 'annual_12m_total_country';
    const row = payload.data.filter(r => r?.series === series && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today && finite(r.value) && (id !== 'ui' || r.value > 0)).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!row) return null;
    asOf = row.date; ref = reference(asOf);
    value = id === 'ui' ? `$ ${number(row.value, 4)}` : `${row.value > 0 ? '+' : ''}${number(row.value)} %`;
  }
  if (!ref) return null;
  let sourceUrl = `https://datosuruguay.com/${pages[id]}`;
  try {
    const url = new URL(payload.meta?.attribution?.url);
    if (url.protocol === 'https:' && url.hostname === 'datosuruguay.com' && !url.username && !url.password) sourceUrl = url.href;
  } catch {}
  return { id, label: labels[id], value, asOf, reference: ref, sourceUrl };
}
