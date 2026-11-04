'use client';
import { useRef, useState, useTransition } from 'react';
import { importArticle } from '@/app/admin/import-action';
import type { Taxonomy } from '@/lib/editorial/types';
import type { ImportedArticle } from '@/lib/editorial/import-types';
import { NewsForm } from './news-form';
export function NewsComposer({authors,categories}:{authors:Taxonomy[];categories:Taxonomy[]}) {
  const [imported,setImported]=useState<ImportedArticle>();
  const [revision,setRevision]=useState(0);
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  const urlInput=useRef<HTMLInputElement>(null);
  function importForEditing() {
    if(pending || !urlInput.current?.reportValidity())return;
    const url=urlInput.current.value.trim();
    if(!window.confirm('Preencher o formulário com esta importação? Os campos ainda não salvos serão substituídos.'))return;
    setError('');startTransition(async()=>{const result=await importArticle(url);if(result.error)setError(result.error);else if(result.article){setImported(result.article);setRevision(value=>value+1);}});
  }
  return <><details className="import-panel"><summary>Importar matéria por URL</summary><p>Prepare um rascunho editável a partir de uma fonte externa. Revise o conteúdo, a autoria e os direitos de republicação antes de publicar. Importar substitui os campos ainda não salvos abaixo.</p><form aria-label="Importar matéria por URL" onSubmit={event=>{event.preventDefault();importForEditing();}}>
    <label>URL da matéria<input ref={urlInput} type="url" name="url" required maxLength={2048} placeholder="https://…" aria-describedby="import-help" /></label><button type="button" className="button" disabled={pending} onClick={importForEditing}>{pending?'Importando…':'IMPORTAR PARA EDIÇÃO'}</button></form><p id="import-help">O conteúdo será importado como rascunho para revisão antes da publicação.</p>{error && <p className="form-error" role="alert">{error}</p>}{imported && <p className="success-message" role="status">Importação preparada como rascunho. Nada foi publicado ou salvo automaticamente.</p>}</details>
    <NewsForm key={revision} imported={imported} authors={authors} categories={categories} importPending={pending} />
  </>;
}
