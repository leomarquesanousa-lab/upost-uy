'use server';
import { requireMutation } from '@/lib/auth/editorial';
import { fetchRemotePage, ImportError } from '@/lib/security/remote-page.mjs';
import { extractArticle } from '@/lib/editorial/import-article.mjs';
import { consumeLimit } from '@/server/services/request-limit';
import { importEditorialImage } from '@/server/services/import-editorial-image';
import { StorageError } from '@/server/services/r2-storage.mjs';
import { EditorialError } from '@/lib/editorial/validation';
export async function importArticle(url: string) {
  try {
    const user=await requireMutation();
    if(typeof url!=='string' || url.length>2048) return {error:'URL inválida.'};
    if(!await consumeLimit(`import:${user.id}`,10,600)) return {error:'Limite de importações atingido. Aguarde 10 minutos.'};
    const page=await fetchRemotePage(url);
    if(!page) return {error:'A fonte não retornou conteúdo.'};
    const article=extractArticle(page.html,url,page.url);
    if(!article.title && !article.body) return {error:'Não foi possível identificar a matéria. Preencha manualmente.'};
    const cover_image = article.external_image_url ? await importEditorialImage(article.external_image_url, user.id) : '';
    return {article: { ...article, cover_image }};
  } catch(error) {
    return {error:error instanceof ImportError || error instanceof StorageError || error instanceof EditorialError ? error.message : 'Importação indisponível. Verifique sua sessão e tente novamente.'};
  }
}
