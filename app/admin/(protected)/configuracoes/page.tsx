import { requireOperations } from '@/lib/auth/operations';
import { operationalSettings } from '@/server/services/operational-settings';
import { SettingsForm } from '@/components/admin/settings-form';
export default async function Page(){await requireOperations(true);return <><h1>Configurações</h1><p>Configurações operacionais do portal.</p><SettingsForm values={await operationalSettings()}/></>;}
