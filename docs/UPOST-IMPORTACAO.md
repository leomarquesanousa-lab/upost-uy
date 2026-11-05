# Correção da importação de matérias

A autorização da Periodistas en Red para conteúdos de seus jornalistas e parceiros é pressuposta. A plataforma não exige comprovação de licença, cadastro prévio de fonte, confirmação de direitos ou aprovação adicional para importar.

## Comportamento
- Criar artigo: editor, formatação, imagens e publicação pelo jornalista.
- Importar por URL: cola o enlace, recupera título, subtítulo, corpo, parágrafos, títulos internos, listas, citações, negrito, cursiva, links e fotografias disponíveis; abre o mesmo editor para alterações e publicação.
- Autor, fonte e data são preenchidos quando encontrados. A URL final após redirecionamentos identifica a fonte e participa da prevenção de duplicidades.
- As fotografias são copiadas para o armazenamento existente e registradas como mídia do portal, incluindo referências locais no corpo do artigo. Uma falha de imagem não descarta o texto.
- Não há publicação automática nem uma etapa extra de aprovação: o jornalista publica pelos controles normais do editor.
- A importação não consulta portal_resources e não depende da migração 009.

## Segurança técnica preservada
Autenticação, permissões, verificação de origem das ações, auditoria, prevenção de duplicidades, validação de URLs, DNS fixado, revalidação de redirecionamentos, limites de tamanho/tempo e sanitização permanecem.
Não se usam credenciais de terceiros nem técnicas para contornar paywalls ou bloqueios de acesso.

Permanecem somente limites técnicos: página de até 2 MB, imagem JPEG/PNG/WebP de até 5 MB com validação dos bytes, até 24 fotografias por importação, três downloads simultâneos, orçamento para iniciar downloads de 45 segundos e até 100.000 caracteres no editor. Limites atingidos e falhas de fotos geram avisos no editor, sem exigir aprovação.

## Banco de dados
A migração 009 ainda não aplicada foi atualizada para não criar os campos de licenciamento nem suas constraints. Os formulários, tipos e SQL de gravação da rede também foram atualizados. Nenhuma migração foi executada.

## Arquivos desta correção
Alterados:
- app/admin/import-action.ts
- lib/editorial/import-article.mjs
- lib/editorial/import-types.ts
- components/editorial/news-composer.tsx
- components/editorial/news-form.tsx
- components/admin/resource-form.tsx
- app/admin/resource-actions.ts
- app/admin/(protected)/red/page.tsx
- server/services/portal-resources.ts
- database/migrations/009_portal_resources.sql
- docs/UPOST-ENTREGA.md

Adicionados:
- lib/editorial/import-images.mjs
- tests/import-action.test.mjs
- tests/import-images.test.mjs
- docs/UPOST-IMPORTACAO.md

Removidos, pois implementavam as restrições substituídas:
- lib/editorial/import-policy.mjs
- tests/import-policy.test.mjs

## Verificação
- 38 testes unitários aprovados, incluindo importação completa com ação de servidor e banco/storage simulados, formatação, imagens, falhas parciais, autenticação, SSRF e duplicatas.
- TypeScript aprovado.
- ESLint sem erros; dois avisos preexistentes em componentes não alterados nesta correção.
- Build de produção local aprovado, sem deploy.
- Sem testes que gravem no banco ou armazenamento reais. A validação autenticada com navegador e serviços reais não foi executada nesta correção.
- Nenhuma migração, push ou publicação executada.
