import Link from 'next/link';

import { Brand } from '@/components/brand';
import { requireUser } from '@/lib/auth/session';
import { logout } from '../actions';
import styles from './admin-layout.module.css';

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
          <small>ADMINISTRACIÓN</small>
        </Link>

        <nav aria-label="Panel">
          <Link href="/admin">
            Panel
          </Link>

          <Link href="/admin/noticias">
            Noticias
          </Link>

          <Link href="/admin/categorias">
            Categorías
          </Link>

          <Link href="/admin/autores">
            Autores
          </Link>

          <Link href="/admin/videos">
            Videos
          </Link>











          {user.role !== 'EDITOR' && (
            <>
              <Link href="/admin/fuentes-automaticas" className={styles.sourcesLink}>Fuentes automáticas</Link>
              <Link href="/admin/red">Medios asociados y red</Link><Link href="/admin/publicidade">
                Publicidad
              </Link>

              <Link href="/admin/usuarios">
                Usuarios
              </Link>
            </>
          )}

          {user.role === 'OWNER' && (
            <>
              <Link href="/admin/integracoes">
                Integraciones
              </Link>

              <Link href="/admin/configuracoes">
                Configuración
              </Link>
            </>
          )}

          <Link href="/admin/minha-conta">
            Mi cuenta
          </Link>
        </nav>

        <form action={logout}>
          <button className="button secondary">
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
