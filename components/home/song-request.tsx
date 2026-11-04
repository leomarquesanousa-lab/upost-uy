'use client';
import { useState, useTransition } from 'react';
import { requestSong } from '@/app/song-action';
export function SongRequest({ startedAt }: { startedAt:number }) {
  const [formStartedAt]=useState(startedAt);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  return <section className="song-section" aria-labelledby="song-title"><div><p className="eyebrow">A TRILHA SONORA É SUA</p><h2 id="song-title">Peça sua música</h2><p>Conte pra gente o que você quer ouvir. Seu pedido chega à equipe da rádio.</p></div>
    <form className="song-form" onSubmit={event=>{
      event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setError('');setMessage('');
      startTransition(async()=>{const result=await requestSong(data);if(result.error)setError(result.error);else{setMessage('Pedido recebido pela equipe. Obrigado por participar!');form.reset();}});
    }}>
      <input type="hidden" name="started_at" value={formStartedAt} />
      <div className="form-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label>Seu nome<input name="name" required minLength={2} maxLength={100} autoComplete="given-name" /></label>
      <label>Música / artista<input name="song" required minLength={2} maxLength={200} /></label>
      <label className="song-message">Mensagem <small>(opcional)</small><input name="message" maxLength={600} /></label>
      <button className="button" disabled={pending}>{pending?'Enviando…':'Pedir música ↗'}</button>
      <small className="song-note">O envio não garante execução. Nome e mensagem são visíveis somente à equipe.</small>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    </form></section>;
}
