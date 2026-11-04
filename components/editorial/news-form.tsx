'use client';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { newsAction } from '@/app/admin/editorial-actions';
import { slugify, statuses, statusLabels } from '@/lib/editorial/shared';
import type { News, Taxonomy } from '@/lib/editorial/types';
import type { ImportedArticle } from '@/lib/editorial/import-types';
import { MarkdownEditor } from './markdown-editor';
import { ImageUpload } from './image-upload';
function utcInput(date: Date | string | null | undefined) { return date ? new Date(date).toISOString().slice(0,16) : ''; }
export function NewsForm({ item, imported, authors, categories, importPending = false }: { item?: News; imported?:ImportedArticle; authors: Taxonomy[]; categories: Taxonomy[]; importPending?: boolean }) {
  const router = useRouter();
  const matchingAuthors = imported?.original_author ? authors.filter(author => author.active && author.name.trim().toLocaleLowerCase('pt-BR') === imported.original_author.trim().toLocaleLowerCase('pt-BR')) : [];
  const importedAuthorId = matchingAuthors.length === 1 ? matchingAuthors[0].id : '';
  const [title,setTitle] = useState(item?.title || imported?.title || '');
  const [slug,setSlug] = useState(item?.slug || slugify(imported?.title || ''));
  const [slugEdited,setSlugEdited] = useState(Boolean(item));
  const [body,setBody] = useState(item?.body || imported?.body || '');
  const [cover,setCover] = useState(item?.cover_image || imported?.cover_image || '');
  const activeUploads = useRef(0);
  const [uploadsPending,setUploadsPending] = useState(0);
  const onUploadBusyChange = useCallback((busy: boolean) => {
    activeUploads.current = Math.max(0, activeUploads.current + (busy ? 1 : -1));
    setUploadsPending(activeUploads.current);
  }, []);
  const [status,setStatus] = useState(item?.status || 'DRAFT');
  const [error,setError] = useState('');
  const [pending,startTransition] = useTransition();
  return <form className="editorial-form news-form" onSubmit={event => {
    event.preventDefault();
    if (activeUploads.current || importPending) { setError('Aguarde o envio das imagens antes de salvar.'); return; }
    const data = new FormData(event.currentTarget);
    for (const field of ['published_at','scheduled_at']) {
      const date = String(data.get(field) || '');
      data.set(field, date ? new Date(`${date}:00Z`).toISOString() : '');
    }
    setError('');
    startTransition(async () => {
      const result = await newsAction(data);
      if (result.error) setError(result.error);
      else { router.push('/admin/noticias?salvo=1'); router.refresh(); }
    });
  }}>
    <input type="hidden" name="id" value={item?.id || ''} /><input type="hidden" name="version" value={item?.version || ''} />
    {imported && <aside className="import-origin"><input type="hidden" name="imported" value="1" /><h2>Origem importada — revisão necessária</h2><p>{imported.source_name || 'Fonte sem nome identificado'}</p><a href={imported.source_url} target="_blank" rel="noopener noreferrer">Consultar matéria original ↗</a>{imported.original_author && <p>Autoria na fonte: {imported.original_author}. Confira o autor editorial abaixo.</p>}{imported.original_published_at && <p>Publicação na fonte: {new Date(imported.original_published_at).toLocaleString('pt-BR',{timeZone:'UTC'})} UTC. Confira a data preenchida abaixo antes de salvar.</p>}{!imported.body && <p>Texto principal não identificado. Preencha o conteúdo manualmente.</p>}{imported.external_image_url && <p>Imagem copiada para o portal. <a href={imported.external_image_url} target="_blank" rel="noopener noreferrer">Consultar referência externa ↗</a>. Confira os direitos de uso antes de publicar.</p>}</aside>}
    <fieldset><legend>Matéria</legend>
      <label>Título *<input name="title" required maxLength={240} value={title} onChange={event => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} /></label>
      <label>Slug *<input name="slug" required maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} /></label>
      {item && <small>Alterar o slug muda o endereço público. Links antigos deixarão de abrir.</small>}
      <label>Subtítulo<textarea aria-label="Subtítulo" name="subtitle" maxLength={400} rows={2} defaultValue={item?.subtitle || imported?.subtitle} /></label>
      <label>Resumo<textarea aria-label="Resumo" name="excerpt" maxLength={600} rows={3} defaultValue={item?.excerpt || imported?.excerpt} /></label>
      <MarkdownEditor value={body} onChange={setBody} onUploadBusyChange={onUploadBusyChange} />
    </fieldset>
    <fieldset><legend>Autoria e categorias</legend>
      <label>Autor *<select aria-label="Autor *" name="author_id" required defaultValue={item?.author_id || importedAuthorId}><option value="">Selecione</option>{authors.filter(author => author.active || author.id === item?.author_id).map(author => <option key={author.id} value={author.id}>{author.name}{!author.active && ' (inativo)'}</option>)}</select></label>
      <div><p>Categorias * <small>Selecione pelo menos uma.</small></p><div className="category-options">{categories.filter(category => category.active || item?.categories.some(c=>c.id===category.id)).map(category => <label className="check-label" key={category.id}><input name="category_ids" type="checkbox" value={category.id} defaultChecked={item?.categories.some(c=>c.id===category.id)} />{category.name}{!category.active && ' (inativa)'}</label>)}</div></div>
      {(!authors.some(a=>a.active) || !categories.some(c=>c.active)) && <p className="form-error">Um administrador deve cadastrar autor e categoria ativos antes da criação da notícia.</p>}
    </fieldset>
    <fieldset><legend>Imagem de capa</legend><ImageUpload label="Enviar imagem de capa" value={cover} onChange={setCover} onBusyChange={onUploadBusyChange} /><input type="hidden" name="cover_image" value={cover} />
      <label>Texto alternativo {cover && '*'}<input name="cover_alt" required={Boolean(cover)} maxLength={300} defaultValue={item?.cover_alt || imported?.cover_alt} /></label>
      <label>Legenda<input name="cover_caption" maxLength={500} defaultValue={item?.cover_caption || imported?.cover_caption} /></label>
      <label>Crédito<input name="cover_credit" maxLength={200} defaultValue={item?.cover_credit || imported?.cover_credit} /></label>
    </fieldset>
    <fieldset><legend>Publicação</legend>
      <label>Status<select aria-label="Status" name="status" value={status} onChange={event=>setStatus(event.target.value as typeof status)}>{statuses.map(value=><option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      <p className="muted">Datas em UTC. Publicada sem data usa o momento do salvamento. Para publicação futura, escolha Agendada. Agendada com data passada fica pública imediatamente.</p>
      <label>Data de publicação (UTC)<input name="published_at" type="datetime-local" defaultValue={utcInput(item?.published_at || imported?.original_published_at)} /></label>
      <label>Agendamento (UTC)<input name="scheduled_at" type="datetime-local" required={status==='SCHEDULED'} defaultValue={utcInput(item?.scheduled_at)} /></label>
      <label className="check-label"><input name="featured" type="checkbox" defaultChecked={item?.featured} /> Destaque na home</label>
      <p className="muted">Para retirar uma notícia do portal, salve com status Arquivada. O histórico é preservado.</p>
    </fieldset>
    <fieldset><legend>SEO</legend>
      <label>Título SEO<input name="seo_title" maxLength={120} defaultValue={item?.seo_title} /></label>
      <label>Descrição SEO<textarea aria-label="Descrição SEO" name="seo_description" maxLength={300} rows={3} defaultValue={item?.seo_description} /></label>
      <label>URL canônica<input name="canonical_url" type="url" maxLength={2048} defaultValue={item?.canonical_url} placeholder="Opcional: endereço original desta matéria" /></label>
      <small>Sem preenchimento, o portal usa título, resumo e endereço da notícia.</small>
    </fieldset>
    <fieldset><legend>Fonte</legend><label>Nome da fonte<input name="source_name" maxLength={200} defaultValue={item?.source_name || imported?.source_name} /></label><label>URL original<input name="source_url" type="url" maxLength={2048} defaultValue={item?.source_url || imported?.source_url} /></label><small>A origem permanece editável e aparece na matéria publicada. Revise os direitos de uso.</small></fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" disabled={pending || uploadsPending > 0 || importPending}>{pending ? 'Salvando…' : uploadsPending > 0 ? 'Enviando imagem…' : 'Salvar notícia'}</button></div>
  </form>;
}
