'use client';
import { useRef, useState, useTransition } from 'react';
import { previewBody } from '@/app/admin/editorial-actions';
import { ImageUpload } from './image-upload';
export function MarkdownEditor({ value, onChange, onUploadBusyChange }: { value: string; onChange: (value: string) => void; onUploadBusyChange?: (busy: boolean) => void }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  function insert(before: string, after = '', placeholder = 'texto') {
    const el = field.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start,end) || placeholder;
    onChange(value.slice(0,start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start+before.length,start+before.length+selected.length); });
  }
  return <section className="markdown-editor">
    <label htmlFor="body">Contenido *</label>
    <div className="editor-toolbar" role="toolbar" aria-label="Formato del contenido">
      <button type="button" onClick={() => insert('**','**')}>Negrita</button>
      <button type="button" onClick={() => insert('*','*')}>Cursiva</button>
      <button type="button" onClick={() => insert('\n## ','\n','Subtítulo')}>Título H2</button>
      <button type="button" onClick={() => insert('\n### ','\n','Intertítulo')}>Título H3</button>
      <button type="button" onClick={() => insert('[','](https://example.com)')}>Link</button>
      <button type="button" onClick={() => insert('\n- ','\n','Item')}>Lista</button>
      <button type="button" onClick={() => insert('\n1. ','\n','Item')}>Lista numerada</button>
      <button type="button" onClick={() => insert('\n> ','\n','Cita')}>Cita</button>
    </div>
    <textarea ref={field} id="body" name="body" value={value} onChange={event => onChange(event.target.value)} required maxLength={100000} rows={18} />
    <small>Separá los párrafos con una línea en blanco. Editá los enlaces entre paréntesis.</small>
    <details><summary>Insertar imagen en el contenido</summary><ImageUpload label="Imagen del contenido" value="" onBusyChange={onUploadBusyChange} onChange={url => insert('\n![', `](${url})\n`, 'Describí la imagen')} /></details>
    <button type="button" className="button secondary" disabled={pending} onClick={() => startTransition(async () => {
      const result = await previewBody(value); setError(result.error || ''); setHtml(result.html || '');
    })}>{pending ? 'Generando…' : 'Actualizar vista previa'}</button>
    {error && <p role="alert">{error}</p>}
    {html && <div className="article-body preview" aria-label="Vista previa del contenido" dangerouslySetInnerHTML={{ __html: html }} />}
  </section>;
}
