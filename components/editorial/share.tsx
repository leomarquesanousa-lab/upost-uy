'use client';
import { useState } from 'react';
export function Share({ title, url }: { title: string; url: string }) {
  const [message,setMessage] = useState('');
  return <div className="share-links"><span>Compartir</span><a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><button type="button" className="text-button" onClick={async () => {
    try { await navigator.clipboard.writeText(url); setMessage('Enlace copiado.'); }
    catch { setMessage('Copiá la URL desde la barra del navegador.'); }
  }}>Copiar enlace</button><span role="status">{message}</span></div>;
}
