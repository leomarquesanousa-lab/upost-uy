import { PublicShell } from '@/components/layout/public-shell';
import { getSettings } from '@/server/services/settings';
import { portalResources,radioStation } from '@/server/services/portal-resources';
import { RadioProvider } from '@/components/radio/radio-player';
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings,radios] = await Promise.all([getSettings(),portalResources('radio')]);
  const stations=radios.items.flatMap(item=>{const station=radioStation(item);return station?[station]:[];});
  return <RadioProvider stations={stations}><PublicShell siteName={settings.siteName} whatsappNumber={settings.whatsappNumber}>{children}</PublicShell></RadioProvider>;
}
