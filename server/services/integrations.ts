import 'server-only';

import { GA4_REGEX, ADSENSE_REGEX } from '@/lib/admin/google-integrations.mjs';
import { getPool } from '@/lib/db/pool';
import { EditorialError } from '@/lib/editorial/validation';

export type IntegrationSettings = {
  GA4_ENABLED: boolean;
  GA4_MEASUREMENT_ID: string;
  ADSENSE_ENABLED: boolean;
  ADSENSE_CLIENT_ID: string;
};

const KEYS = [
  'GA4_ENABLED',
  'GA4_MEASUREMENT_ID',
  'ADSENSE_ENABLED',
  'ADSENSE_CLIENT_ID',
] as const;

export async function integrationSettings(): Promise<IntegrationSettings> {
  const defaults: IntegrationSettings = {
    GA4_ENABLED: process.env.GA4_ENABLED === 'true',
    GA4_MEASUREMENT_ID: process.env.GA4_MEASUREMENT_ID || '',
    ADSENSE_ENABLED: process.env.ADSENSE_ENABLED === 'true',
    ADSENSE_CLIENT_ID: process.env.ADSENSE_CLIENT_ID || '',
  };

  if (!process.env.DATABASE_URL) return defaults;

  try {
    const result = await getPool().query(
      'SELECT key,value FROM settings WHERE key = ANY($1::text[])',
      [KEYS],
    );
    const values = Object.fromEntries(result.rows.map(row => [row.key, row.value]));

    return {
      GA4_ENABLED: (values.GA4_ENABLED ?? String(defaults.GA4_ENABLED)) === 'true',
      GA4_MEASUREMENT_ID: (values.GA4_MEASUREMENT_ID ?? defaults.GA4_MEASUREMENT_ID).trim(),
      ADSENSE_ENABLED: (values.ADSENSE_ENABLED ?? String(defaults.ADSENSE_ENABLED)) === 'true',
      ADSENSE_CLIENT_ID: (values.ADSENSE_CLIENT_ID ?? defaults.ADSENSE_CLIENT_ID).trim(),
    };
  } catch {
    return defaults;
  }
}

export async function saveIntegrationSettings(form: FormData, userId: string) {
  const ga4Id = String(form.get('GA4_MEASUREMENT_ID') || '').trim().toUpperCase();
  const adsenseId = String(form.get('ADSENSE_CLIENT_ID') || '').trim().toLowerCase();
  const ga4Enabled = form.get('GA4_ENABLED') === 'on';
  const adsenseEnabled = form.get('ADSENSE_ENABLED') === 'on';

  if (ga4Enabled && !GA4_REGEX.test(ga4Id)) {
    throw new EditorialError('Informe um ID válido do Google Analytics 4, por exemplo G-XXXXXXXXXX.');
  }

  if (adsenseEnabled && !ADSENSE_REGEX.test(adsenseId)) {
    throw new EditorialError('Informe um Publisher ID válido do AdSense, por exemplo ca-pub-1234567890123456.');
  }

  if (ga4Id && !GA4_REGEX.test(ga4Id)) {
    throw new EditorialError('O ID do Google Analytics 4 informado é inválido.');
  }

  if (adsenseId && !ADSENSE_REGEX.test(adsenseId)) {
    throw new EditorialError('O Publisher ID do Google AdSense informado é inválido.');
  }

  const values: Record<string, string> = {
    GA4_ENABLED: ga4Enabled ? 'true' : 'false',
    GA4_MEASUREMENT_ID: ga4Id,
    ADSENSE_ENABLED: adsenseEnabled ? 'true' : 'false',
    ADSENSE_CLIENT_ID: adsenseId,
  };

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query(
      "SELECT id FROM users WHERE id=$1 AND role='OWNER' AND active AND deleted_at IS NULL FOR SHARE",
      [userId],
    );
    if (!owner.rowCount) throw new EditorialError('Somente OWNER pode alterar integrações.');

    for (const [key, value] of Object.entries(values)) {
      await client.query(
        'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()',
        [key, value],
      );
    }

    await client.query(
      "INSERT INTO audit_log(user_id,action,entity,metadata) VALUES($1,'integrations.updated','integrations',$2)",
      [
        userId,
        JSON.stringify({
          ga4Enabled,
          adsenseEnabled,
          ga4Configured: Boolean(ga4Id),
          adsenseConfigured: Boolean(adsenseId),
        }),
      ],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
