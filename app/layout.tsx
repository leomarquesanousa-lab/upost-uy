import type { Metadata } from 'next';
import { RadioProvider } from '@/components/radio/radio-player';
import { getSettings } from '@/server/services/settings';
import './globals.css';
import './visual-refresh.css';
import { currentProgramming } from '@/server/services/programming';
import { integrationSettings } from '@/server/services/integrations';
import { GoogleAdSense,GoogleAnalytics } from '@/components/integrations/google-scripts';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Biosfera Rádio TV Web', description: 'Biosfera: rádio ao vivo, informação e conexão.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings,programming,integrations] = await Promise.all([getSettings(),currentProgramming(),integrationSettings()]);
  return <html lang="pt-BR"><body><RadioProvider streamUrl={settings.radioStreamUrl} initialProgramming={programming}>{children}</RadioProvider>{integrations.GA4_ENABLED&&integrations.GA4_MEASUREMENT_ID&&<GoogleAnalytics measurementId={integrations.GA4_MEASUREMENT_ID}/>} {integrations.ADSENSE_ENABLED&&integrations.ADSENSE_CLIENT_ID&&<GoogleAdSense clientId={integrations.ADSENSE_CLIENT_ID}/>}</body></html>;
}
