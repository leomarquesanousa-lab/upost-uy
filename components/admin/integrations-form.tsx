'use client';

import { useState } from 'react';
import { integrationsAction } from '@/app/admin/operations-actions';
import type { IntegrationSettings } from '@/server/services/integrations';

export function IntegrationsForm({ values }: { values: IntegrationSettings }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="phase-form"
      onSubmit={async event => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        const result = await integrationsAction(new FormData(event.currentTarget));
        setBusy(false);
        setMessage(result.error || 'Integrações salvas.');
      }}
    >
      <section className="integration-card">
        <div>
          <h2>Google Analytics 4</h2>
          <p>Ative a medição global do portal usando o ID GA4 da propriedade.</p>
        </div>
        <label>
          ID de medição
          <input
            name="GA4_MEASUREMENT_ID"
            defaultValue={values.GA4_MEASUREMENT_ID}
            placeholder="G-XXXXXXXXXX"
            maxLength={32}
            autoComplete="off"
          />
        </label>
        <label className="check">
          <input name="GA4_ENABLED" type="checkbox" defaultChecked={values.GA4_ENABLED} />
          Analytics ativo
        </label>
        <small>
          Quando ativo, o script do GA4 é carregado em todas as páginas públicas e administrativas do portal.
        </small>
      </section>

      <section className="integration-card">
        <div>
          <h2>Google AdSense</h2>
          <p>Configure o Publisher ID para carregar o script oficial do AdSense no portal.</p>
        </div>
        <label>
          Publisher ID
          <input
            name="ADSENSE_CLIENT_ID"
            defaultValue={values.ADSENSE_CLIENT_ID}
            placeholder="ca-pub-1234567890123456"
            maxLength={40}
            autoComplete="off"
          />
        </label>
        <label className="check">
          <input name="ADSENSE_ENABLED" type="checkbox" defaultChecked={values.ADSENSE_ENABLED} />
          AdSense ativo
        </label>
        <small>
          O carregamento do script não substitui a publicidade própria da Biosfera. Os dois sistemas continuam separados.
        </small>
      </section>

      <p className="integration-note">
        Importante: anúncios do AdSense só aparecem depois que a conta/site estiverem aprovados e a configuração de anúncios estiver concluída no Google AdSense.
      </p>
      <p role="status">{message}</p>
      <button className="button" disabled={busy}>Salvar integrações</button>
    </form>
  );
}
