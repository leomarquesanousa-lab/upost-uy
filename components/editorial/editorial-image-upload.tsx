'use client';
/* eslint-disable @next/next/no-img-element -- local preview; uploaded images are validated and resized by the existing endpoint */
import { useEffect, useId, useRef, useState } from 'react';

const formats: Record<string, string[]> = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };
type Selection = { url: string; name: string; size: number };
function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export function EditorialImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Selection | null>(null);
  const [uploaded, setUploaded] = useState<Selection | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function select(files: FileList | null) {
    if (uploading.current || !files?.length) return;
    setError(''); setNotice('');
    if (files.length !== 1) { setError('Selecione uma imagem por vez.'); return; }
    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!formats[file.type]?.includes(extension)) { setError('Formato de imagem não permitido. Use JPG, PNG ou WEBP.'); return; }
    if (!file.size) { setError('O arquivo está vazio. Selecione outra imagem.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Arquivo muito grande. O limite é 5 MB.'); return; }
    uploading.current = true; setBusy(true);
    setPreview({ url: URL.createObjectURL(file), name: file.name, size: file.size });
    try {
      const response = await fetch('/api/editorial/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a imagem. Tente novamente.');
      onChange(result.url);
      setUploaded({ url: result.url, name: file.name, size: file.size });
      setNotice('Imagem enviada. Salve o formulário para confirmar a alteração.');
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.' : failure instanceof Error ? failure.message : 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      uploading.current = false; setBusy(false); setPreview(null);
      if (input.current) input.current.value = '';
    }
  }
  const selected = preview || (uploaded?.url === value ? uploaded : null);
  const image = preview?.url || value;
  return <div className="image-upload editorial-image-upload" aria-busy={busy}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={event => { void select(event.currentTarget.files); event.currentTarget.value = ''; }}/>
    <button type="button" className={`image-dropzone${dragging ? ' is-dragging' : ''}`} disabled={busy} aria-label={`${label}: selecionar imagem`} aria-describedby={`${id}-help`} onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); if (!busy) { event.dataTransfer.dropEffect = 'copy'; setDragging(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); void select(event.dataTransfer.files); }}>
      <span className="upload-symbol" aria-hidden="true">↑</span>
      <strong id={`${id}-prompt`}>{busy ? 'Enviando imagem…' : 'Arraste uma imagem aqui'}</strong>
      {!busy && <span>ou <span className="upload-select-text">clique para selecionar</span></span>}
      <small>JPG, PNG ou WEBP</small>
    </button>
    <small id={`${id}-help`}>Até 5 MB e 20 megapixels. Selecione uma imagem por vez.</small>
    {image && <div className="editorial-upload-preview"><img src={image} alt={`Prévia: ${selected?.name || label}`}/><div className="upload-file-info"><strong>{selected?.name || 'Imagem atual'}</strong>{selected && <span>{fileSize(selected.size)}</span>}<div className="upload-file-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => input.current?.click()}>Trocar imagem</button><button type="button" className="text-button" disabled={busy} aria-label="Remover imagem do formulário" onClick={() => { onChange(''); setUploaded(null); setError(''); setNotice('Imagem removida do formulário.'); if (input.current) input.current.value = ''; }}>Remover</button></div></div></div>}
    <p className="upload-status" role="status">{busy ? 'Enviando e validando a imagem…' : notice}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
