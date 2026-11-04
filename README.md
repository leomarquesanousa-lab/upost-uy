# Portal Biosfera Rádio TV Web

Portal local em Next.js, TypeScript e Tailwind, com PostgreSQL via `pg`. Fases 1, 2 e 2.1: rádio persistente, autenticação, núcleo editorial, home integrada e importação assistida de matérias.

## Executar

1. `npm install`.
2. Copie `.env.example` para `.env.local` somente se ainda não existir. Preserve a conexão Neon e o OWNER já configurados.
3. Configure `DATABASE_URL` e `SITE_URL` (localmente: `http://localhost:3000`).
4. `npm run db:migrate` — aplica somente migrations pendentes, sem alterar a 001.
5. `npm run dev`.

Portal: http://localhost:3000 · Painel: http://localhost:3000/admin

Em instalação nova, configure as três variáveis `ADMIN_INITIAL_OWNER_*`, execute `npm run db:bootstrap` e remova essas variáveis. Não recrie o OWNER já existente.

No PowerShell com scripts bloqueados, use `npm.cmd`.

## Fluxo editorial

- OWNER/ADMIN cadastram categorias e autores em `/admin/categorias` e `/admin/autores`.
- OWNER/ADMIN/EDITOR criam e editam notícias em `/admin/noticias`.
- Selecione autor e pelo menos uma categoria. Escreva com os controles de Markdown e confira a prévia.
- Envie imagens JPEG, PNG ou WebP de até 5 MB. As imagens convertidas são persistidas no Cloudflare R2; configure as variáveis `R2_*` em cada ambiente. Sem R2, uploads de imagens falham, sem fallback de escrita local.
- A importação por URL baixa a capa identificada, valida e salva uma cópia WebP no R2 antes de preencher o formulário. A origem externa não é usada como imagem publicada.
- Antes de salvar uma notícia, capa e imagens renderizadas no corpo precisam existir no R2 e em `media_assets`.
- Salve como rascunho, publicada, agendada ou arquivada. Datas do formulário são **UTC**.
- Notícias agendadas aparecem automaticamente quando a data chega, sem cron.
- Em `/admin/noticias/nova`, “Importar matéria por URL” preenche um rascunho editável. Revise texto, fonte, autor e categorias antes de salvar; a importação não salva nem publica automaticamente.
- Pedidos enviados pela home aparecem em `/admin/pedidos-musicais`, para OWNER, ADMIN e EDITOR.
- A câmera carrega apenas após clique. Configure `LIVE_CAMERA_EMBED_URL` em settings ou no ambiente; existe fallback para o player Biosfera.

## Verificar

```shell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E requer Edge, porta 3100 livre e `TEST_DATABASE_URL` de PostgreSQL **local** com permissão de criar banco. Pode ser configurada em `.env.test.local`, ignorado pelo Git. Os testes recusam usar Neon e criam/removem um banco temporário próprio.

Veja a [documentação técnica](docs/DOCUMENTACAO_TECNICA_PORTAL_BIOSFERA.md) para tabelas, permissões, uploads, SEO, testes e decisões. Sem deploy, DNS, migração do portal antigo ou alterações no site atual.

Storage editorial: [investigação e operação](docs/STORAGE_EDITORIAL.md). Health check sem varrer objetos:

```shell
node scripts/check-editorial-media.mjs --health
node scripts/check-editorial-media.mjs --path /media/<UUID>.webp
```
