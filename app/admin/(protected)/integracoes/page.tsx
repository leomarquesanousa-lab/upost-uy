import { requireOperations } from '@/lib/auth/operations';
import { IntegrationsForm } from '@/components/admin/integrations-form';
import { integrationSettings } from '@/server/services/integrations';

export default async function Page() {
  await requireOperations(true);
  const values = await integrationSettings();

  return (
    <>
      <h1>Integrações</h1>
      <p>Configure Google Analytics e Google AdSense sem editar o código do portal.</p>
      <IntegrationsForm values={values} />
    </>
  );
}
