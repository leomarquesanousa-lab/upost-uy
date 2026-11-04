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
    <label htmlFor="body">Conteúdo *</label>
    <div className="editor-toolbar" role="toolbar" aria-label="Formatação do conteúdo">
      <button type="button" onClick={() => insert('**','**')}>Negrito</button>
      <button type="button" onClick={() => insert('*','*')}>Itálico</button>
      <button type="button" onClick={() => insert('\n## ','\n','Subtítulo')}>Título H2</button>
      <button type="button" onClick={() => insert('\n### ','\n','Intertítulo')}>Título H3</button>
      <button type="button" onClick={() => insert('[','](https://exemplo.com)')}>Link</button>
      <button type="button" onClick={() => insert('\n- ','\n','Item')}>Lista</button>
      <button type="button" onClick={() => insert('\n1. ','\n','Item')}>Lista numerada</button>
      <button type="button" onClick={() => insert('\n> ','\n','Citação')}>Citação</button>
    </div>
    <textarea ref={field} id="body" name="body" value={value} onChange={event => onChange(event.target.value)} required maxLength={100000} rows={18} />
    <small>Separe parágrafos com uma linha em branco. Quebras simples também são preservadas. Edite os links entre parênteses.</small>
    <details><summary>Inserir imagem no conteúdo</summary><ImageUpload label="Imagem do conteúdo" value="" onBusyChange={onUploadBusyChange} onChange={url => insert('\n![', `](${url})\n`, 'Descreva a imagem')} /></details>
    <button type="button" className="button secondary" disabled={pending} onClick={() => startTransition(async () => {
      const result = await previewBody(value); setError(result.error || ''); setHtml(result.html || '');
    })}>{pending ? 'Gerando…' : 'Atualizar prévia'}</button>
    {error && <p role="alert">{error}</p>}
    {html && <div className="article-body preview" aria-label="Prévia do conteúdo" dangerouslySetInnerHTML={{ __html: html }} />}
  </section>;
}
