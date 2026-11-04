'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { userAction } from '@/app/admin/operations-actions';
import styles from './user-row-actions.module.css';

export function UserRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(intent: string) {
    if (intent === 'delete' && !confirm(`Excluir logicamente ${name} e encerrar suas sessões?`)) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('id', id);
    form.set('intent', intent);
    try {
      const result = await userAction(form);
      if (result.error) setError(result.error);
      else if (result.reauth) router.push('/admin/login');
      else router.refresh();
    } finally { setBusy(false); }
  }
  return <div className={styles.actions}>
    <Link href={`/admin/usuarios/${id}`}>Editar</Link>
    <details>
      <summary aria-label={`Ações para ${name}`}>Mais ações</summary>
      <div className={styles.menu}>
        <button type="button" disabled={busy} onClick={() => void act(active ? 'deactivate' : 'activate')}>{active ? 'Desativar' : 'Ativar'}</button>
        <Link href={`/admin/usuarios/${id}?acao=senha`}>Redefinir senha</Link>
        <button type="button" disabled={busy} onClick={() => void act('delete')}>Excluir usuário</button>
      </div>
    </details>
    {error && <p role="alert">{error}</p>}
  </div>;
}
