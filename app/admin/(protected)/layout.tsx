import Link from 'next/link';

import { Brand } from '@/components/brand';
import { requireUser } from '@/lib/auth/session';
import { logout } from '../actions';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link
          className="admin-brand"
          href="/"
        >
          <Brand light />
          <small>ADMINISTRAÇÃO</small>
        </Link>

        <nav aria-label="Painel">
          <Link href="/admin">
            Dashboard
          </Link>

          <Link href="/admin/noticias">
            Notícias
          </Link>

          <Link href="/admin/categorias">
            Categorias
          </Link>

          <Link href="/admin/autores">
            Autores
          </Link>

          <Link href="/admin/videos">
            Vídeos
          </Link>

          <Link href="/admin/pedidos-musicais">
            Pedidos musicais
          </Link>

          <Link href="/admin/programacao">
            Programação
          </Link>

          <Link href="/admin/programas">
            Programas
          </Link>

          <Link href="/admin/apresentadores">
            Apresentadores
          </Link>

          <Link href="/admin/chat">
            Chat
          </Link>

          {user.role !== 'EDITOR' && (
            <>
              <Link href="/admin/publicidade">
                Publicidade
              </Link>

              <Link href="/admin/usuarios">
                Usuários
              </Link>
            </>
          )}

          {user.role === 'OWNER' && (
            <>
              <Link href="/admin/integracoes">
                Integrações
              </Link>

              <Link href="/admin/configuracoes">
                Configurações
              </Link>
            </>
          )}

          <Link href="/admin/minha-conta">
            Minha Conta
          </Link>
        </nav>

        <form action={logout}>
          <button className="button secondary">
            Sair da conta
          </button>
        </form>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}