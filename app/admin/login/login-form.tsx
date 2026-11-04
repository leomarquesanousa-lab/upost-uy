'use client';
import { useActionState } from 'react';
import { login } from '../actions';
export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: '' });
  return <form action={action} className="login-form">
    <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
    <label>Senha<input name="password" type="password" required maxLength={256} autoComplete="current-password" /></label>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <button className="button" disabled={pending}>{pending ? 'Entrando…' : 'Entrar no painel →'}</button>
  </form>;
}
