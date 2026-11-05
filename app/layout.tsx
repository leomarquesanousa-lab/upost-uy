import type { Metadata } from 'next';

import './globals.css';
import './visual-refresh.css';
import './upost.css';
import { integrationSettings } from '@/server/services/integrations';
import {ConsentedScripts} from '@/components/integrations/consented-scripts';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { icons: {icon:'/brand/favicon.svg',apple:'/brand/favicon.svg'}, title: 'UPOST.uy | Noticias de Uruguay y el mundo', description: 'Periodismo independiente, noticias verificadas y voces propias. La verdad nos une.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const integrations = await integrationSettings();
  return <html lang="es-UY"><body>{children}<ConsentedScripts measurementId={integrations.GA4_ENABLED?integrations.GA4_MEASUREMENT_ID||"":""} clientId={integrations.ADSENSE_ENABLED?integrations.ADSENSE_CLIENT_ID||"":""}/></body></html>;
}
