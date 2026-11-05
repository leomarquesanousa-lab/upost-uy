'use client';
import { useRef, useState, useTransition } from 'react';
import { importArticle } from '@/app/admin/import-action';
import type { Taxonomy } from '@/lib/editorial/types';
import type { ImportedArticle } from '@/lib/editorial/import-types';
import { NewsForm } from './news-form';

export function NewsComposer({ authors, categories }: { authors: Taxonomy[]; categories: Taxonomy[] }) {
  const [mode, setMode] = useState<'write' | 'import'>('write');
  const [imported, setImported] = useState<ImportedArticle>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const urlInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDivElement>(null);

  function importForEditing() {
    if (pending || !urlInput.current?.reportValidity()) return;
    const url = urlInput.current.value.trim();
    setError('');
    start(async () => {
      const result = await importArticle(url);
      if (result.error) setError(result.error);
      else if (result.article) {
        setImported(result.article);
        setRevision(value => value + 1);
        requestAnimationFrame(() => editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
  }
  return <>
    <div className="composer-modes" role="group" aria-label="Cómo crear la noticia">
      <button type="button" className="button secondary" disabled={pending} aria-pressed={mode === 'write'} onClick={() => setMode('write')}>Crear artículo</button>
      <button type="button" className="button secondary" disabled={pending} aria-pressed={mode === 'import'} onClick={() => setMode('import')}>Importar por URL</button>
    </div>
    {mode === 'import' && <section className="import-panel">
      <h2>Importar por URL</h2>
      <p>Pegá el enlace para recuperar el texto, la estructura, las fotografías y los datos de origen disponibles. Después podés editar y publicar desde el mismo formulario.</p>
      <form aria-label="Importar por URL" onSubmit={event => { event.preventDefault(); importForEditing(); }}>
        <label>URL del artículo<input ref={urlInput} type="url" required maxLength={2048} placeholder="https://…" disabled={pending}/></label>
        <button className="button" disabled={pending}>{pending ? 'Importando texto y fotografías…' : 'Importar al editor'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {imported && <p role="status">Artículo cargado en el editor. Podés modificarlo y publicarlo. Fotografías importadas: {imported.imported_image_count || 0}.</p>}
    </section>}
    <div ref={editor}><NewsForm key={revision} imported={imported} authors={authors} categories={categories} importPending={pending}/></div>
  </>;
}
