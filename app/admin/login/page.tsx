import Link from 'next/link';
import { Brand } from '@/components/brand';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';
export default async function LoginPage() {
  if (await getUser()) redirect('/admin');
  return <main className="login-shell"><div className="login-card"><Link href="/" className="admin-brand"><Brand/></Link><p className="eyebrow">ÁREA ADMINISTRATIVA</p><h1>Bem-vindo de volta.</h1><p>Entre com sua conta para acessar o painel.</p><LoginForm /><Link href="/">← Voltar ao portal</Link></div></main>;
}
