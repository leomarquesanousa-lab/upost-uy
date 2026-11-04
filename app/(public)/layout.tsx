import { PublicShell } from '@/components/layout/public-shell';
import { getSettings } from '@/server/services/settings';
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return <PublicShell siteName={settings.siteName} whatsappNumber={settings.whatsappNumber}>{children}</PublicShell>;
}
