# UPOST.uy — entrega local

## Resultado
Implementação real no repositório C:\tech\upost-uy. Nenhum push, deploy, alteração de DNS, migração, bootstrap ou gravação editorial foi executado. O repositório C:\tech\biosfera-site não foi acessado nem modificado.

## Funcionalidades implementadas
- Identidade UPOST.uy, Periodistas en Red, slogan, favicon e paleta editorial.
- Cabeçalho com data de Montevidéu, navegação por editorias, busca e menu expansível responsivo.
- Home com três colunas quando há matérias suficientes, adaptações para edições pequenas, seleção por destaque e urgência e distribuição sem repetição.
- Te explicamos, Opinión, Investigaciones, Especialistas, Deportes, Cultura e Podcast aparecem com matérias reais da categoria, sem preencher blocos vazios com conteúdo inventado.
- Editorias filtram notícias publicadas usando o repositório existente. Categorias e autores continuam administráveis.
- Fluxos Escribir artículo e Importar desde URL. Editor Markdown, uploads e sanitização preservados. Prévia do artigo com título, subtítulo, autor e corpo.
- Rascunhos, publicação, agendamento e arquivamento preservados. Último momento usa o identificador de uma notícia real nas configurações existentes; somente notícias públicas aparecem no aviso.
- Importação recupera o texto completo disponível, a formatação e as fotografias, com autor, fonte e data quando encontrados. A autorização da associação é pressuposta; não há cadastro prévio de fonte, comprovação de licença ou aprovação adicional.
- Proteções de SSRF, DNS fixado, redirects revalidados, limites e timeout preservadas. Duplicatas são verificadas antes da prévia e novamente na transação de criação, com trava por URL.
- Área /admin/red para cadastro e edição de parceiros, rádios e fontes. Gestão restrita a OWNER/ADMIN; alterações auditadas. Ativação/inativação e ordenação.
- Cards públicos de parceiros e rádios; player HTML para streams HTTPS autorizados. Nenhuma estação ou parceiro foi inventado.
- Publicidade real reaproveitada: topo, entre seções, lateral quando há terceira coluna, fim da home e rodapé. Nada é mostrado quando não há campanha elegível.
- Datas do editor em America/Montevideo e persistência em UTC. Busca textual espanhola, canonical, Open Graph es_UY, sitemap, robots e dados estruturados.
- Player e links públicos da rádio anterior retirados da experiência principal. Componentes antigos preservados; rotas legadas redirecionadas.
- Textos principais públicos e editoriais em espanhol; cookies UPOST, consentimento por categoria antes de carregar Analytics/AdSense.

## Dependências do cliente
- Lista definitiva de parceiros, logos autorizados, URLs, descrições e tipos.
- As três rádios: nomes, imagens e streams HTTPS autorizados.
- A associação pressupõe autorização prévia para os conteúdos de seus jornalistas e parceiros; o sistema não verifica licenciamento.
- Matérias, autores e categorias reais. Criar as categorias no painel com os slugs: uruguay, mundo, sociedad, deportes, cultura, podcast, especialistas, opinion, investigaciones e, se desejado, te-explicamos.
- Dados e canais institucionais de contato. As páginas institucionais informam os campos ainda não confirmados; precisam da revisão e aprovação da organização antes da abertura pública.
- Configurações UPOST de domínio, armazenamento, analytics e publicidade verificadas pelo responsável, sem reutilizar contas da Biosfera.

## Migração preparada, não aplicada
`database/migrations/009_portal_resources.sql` cria portal_resources, índice de busca espanhol e duas posições publicitárias inicialmente inativas. Não cria parceiros, rádios, fontes, usuários, matérias ou campanhas.
Revisar e testar em uma cópia isolada antes de aplicar pelo procedimento versionado existente. Não foi executado `npm run db:migrate`.
Até a aplicação, /admin/red informa a dependência e os blocos públicos exibem estados vazios. A importação de texto e imagens independe da nova tabela e funciona sem cadastro de fontes.

## Validação
- TypeScript: aprovado.
- ESLint: sem erros; dois avisos existentes em admin-session-guard e public-video-player.
- Testes unitários: ver resultado atualizado em UPOST-IMPORTACAO.md. Incluem importação de conteúdo, deduplicação/distribuição, urgência, fuso, SSRF, sanitização, uploads, storage e autenticação.
- Build de produção local: aprovado; sem deploy.
- HTTP local: 21 rotas responderam 200, com lang es-UY, um único main e sem Biosfera no texto público. /radio respondeu 307 para /radios.
- git diff --check: sem erros de whitespace.
- E2E: execução interrompida pela proteção do script por ausência de TEST_DATABASE_URL de PostgreSQL local. O banco remoto não foi usado.
- Navegador: a ferramenta informou inventário vazio. Desktop, tablet, mobile e interações ainda não receberam inspeção visual. CSS responsivo foi implementado, mas isso não substitui teste visual.
- Fluxos autenticados de publicação/importação/upload e a migração nova não foram executados contra o banco existente.

## Pendências antes de deploy
1. Aplicar e validar a migração 009 em ambiente isolado e depois pelo procedimento aprovado.
2. Realizar QA visual em desktop/tablet/mobile e testes autenticados com PostgreSQL isolado; adaptar expectativas antigas dos E2E que ainda descrevem a rádio brasileira.
3. Revisar os textos restantes de módulos administrativos legados, configurações e mensagens menos utilizadas. A localização principal foi feita, mas não se declara tradução integral de todo o legado.
4. O cadastro de RSS/API está preparado; consumo genérico de feeds/APIs, prévia de lotes e um agendador de importações permanecem por implementar/configurar. Nenhum job é iniciado.
5. Podcast usa matérias da categoria; um catálogo dedicado de episódios/áudio depende do formato e materiais do cliente.
6. Exclusão física de notícias não foi adicionada: o fluxo de arquivamento despublica preservando dados e auditoria.
7. Confirmar materiais, contatos, condições institucionais e configurações próprias UPOST.

## Preservação do trabalho local
Havia alterações locais antes desta execução em homepage, layout raiz, Brand, cabeçalho, pool, package.json/lock e settings, além de check-upost-db.mjs e check-upost-tables.mjs. Foram preservadas; homepage/layout/cabeçalho receberam mudanças sobre o conteúdo que estava no disco. Os scripts de diagnóstico não foram executados.
Arquivos já modificados que não receberam implementação nova nesta execução: `components/brand.tsx`, `lib/db/pool.ts`, `package.json`, `package-lock.json`, `server/services/settings.ts`.

## Inventário do diff final
Inclui alterações já existentes, indicadas acima, e arquivos novos desta execução. O inventário completo abaixo permite revisão antes de qualquer commit.

- `app/(public)/[section]/page.tsx`
- `app/(public)/busca/page.tsx`
- `app/(public)/noticias/[slug]/page.tsx`
- `app/(public)/noticias/page.tsx`
- `app/(public)/page.tsx`
- `app/(public)/politica-de-cookies/page.tsx`
- `app/(public)/politica-de-privacidade/page.tsx`
- `app/(public)/termos-de-uso/page.tsx`
- `app/admin/(protected)/configuracoes/page.tsx`
- `app/admin/(protected)/integracoes/page.tsx`
- `app/admin/(protected)/layout.tsx`
- `app/admin/(protected)/minha-conta/page.tsx`
- `app/admin/(protected)/noticias/page.tsx`
- `app/admin/(protected)/page.tsx`
- `app/admin/(protected)/pedidos-musicais/page.tsx`
- `app/admin/(protected)/publicidade/[id]/page.tsx`
- `app/admin/(protected)/publicidade/page.tsx`
- `app/admin/(protected)/red/page.tsx`
- `app/admin/(protected)/usuarios/[id]/page.tsx`
- `app/admin/(protected)/usuarios/page.tsx`
- `app/admin/(protected)/videos/[id]/page.tsx`
- `app/admin/(protected)/videos/novo/page.tsx`
- `app/admin/(protected)/videos/page.tsx`
- `app/admin/actions.ts`
- `app/admin/editorial-actions.ts`
- `app/admin/import-action.ts`
- `app/admin/layout.tsx`
- `app/admin/login/login-form.tsx`
- `app/admin/resource-actions.ts`
- `app/api/editorial/upload/route.ts`
- `app/icon.png`
- `app/layout.tsx`
- `app/sitemap.ts`
- `app/upost.css`
- `components/admin/ad-form.tsx`
- `components/admin/integrations-form.tsx`
- `components/admin/resource-form.tsx`
- `components/admin/settings-form.tsx`
- `components/admin/user-form.tsx`
- `components/ads/banner.tsx`
- `components/brand.tsx`
- `components/editorial/editorial-image-upload.tsx`
- `components/editorial/file-upload.tsx`
- `components/editorial/markdown-editor.tsx`
- `components/editorial/news-card.tsx`
- `components/editorial/news-composer.tsx`
- `components/editorial/news-edit-page.tsx`
- `components/editorial/news-form.tsx`
- `components/editorial/public-news.tsx`
- `components/editorial/resource-list.tsx`
- `components/editorial/share.tsx`
- `components/editorial/taxonomy-form.tsx`
- `components/editorial/taxonomy-pages.tsx`
- `components/integrations/consented-scripts.tsx`
- `components/integrations/google-scripts.tsx`
- `components/layout/public-header.tsx`
- `components/layout/public-shell.tsx`
- `components/privacy/cookie-consent.tsx`
- `components/radio/radio-player.tsx`
- `database/migrations/009_portal_resources.sql`
- `lib/admin/policy.mjs`
- `lib/admin/roles.ts`
- `lib/auth/editorial.ts`
- `lib/auth/operations.ts`
- `lib/brand.ts`
- `lib/db/pool.ts`
- `lib/editorial/distribution.mjs`
- `lib/editorial/import-images.mjs`
- `lib/editorial/import-types.ts`
- `lib/editorial/seo.ts`
- `lib/editorial/shared.ts`
- `lib/editorial/time.mjs`
- `lib/editorial/types.ts`
- `lib/editorial/validation.ts`
- `lib/portal.ts`
- `lib/programming/engine.mjs`
- `lib/security/remote-page.mjs`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `public/brand/favicon.svg`
- `public/brand/upost.svg`
- `server/repositories/editorial.ts`
- `server/services/admin-users.ts`
- `server/services/ads.ts`
- `server/services/editorial.ts`
- `server/services/operational-settings.ts`
- `server/services/portal-resources.ts`
- `server/services/programming.ts`
- `server/services/settings.ts`
- `server/services/videos.ts`
- `tests/distribution.test.mjs`
- `tests/import-action.test.mjs`
- `tests/import-images.test.mjs`
- `tests/importer.test.mjs`
- `tests/portal-time.test.mjs`

