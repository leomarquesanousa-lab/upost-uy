import 'server-only';
import { getPool } from '@/lib/db/pool';
import { whatsappNumber } from '@/lib/whatsapp.mjs';
export const TV_REFERENCES = {
  embed: 'https://playerv.tvr.ovh/video-premium/video36282/true/false/',
  hls: 'https://s1.tvr.ovh/video36282/video36282/playlist.m3u8',
};
const DEFAULT_STREAM = 'https://s1.dvr.ovh:6696/stream';
function safeStream(value?: string) {
  try { const url = new URL(value ?? ''); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch {}
  return undefined;
}
export async function getSettings() {
  let values: Record<string, string> = {};
  let databaseAvailable = false;
  if (process.env.DATABASE_URL) {
    try {
      const result = await getPool().query('SELECT key,value FROM settings WHERE key = ANY($1::text[])', [['SITE_NAME', 'RADIO_STREAM_URL', 'LIVE_CAMERA_EMBED_URL', 'WHATSAPP_NUMBER']]);
      values = Object.fromEntries(result.rows.map(row => [row.key, row.value]));
      databaseAvailable = true;
    } catch { /* Portal público continua disponível durante indisponibilidade do banco. */ }
  }
  return {
    siteName: (values.SITE_NAME || process.env.SITE_NAME || 'Biosfera Rádio TV Web').slice(0, 120),
    radioStreamUrl: safeStream(values.RADIO_STREAM_URL) || safeStream(process.env.RADIO_STREAM_URL) || DEFAULT_STREAM,
    liveCameraEmbedUrl: safeStream(values.LIVE_CAMERA_EMBED_URL) || safeStream(process.env.LIVE_CAMERA_EMBED_URL) || TV_REFERENCES.embed,
    databaseAvailable,
    whatsappNumber: whatsappNumber(values.WHATSAPP_NUMBER),
  };
}
