# UPOST — SEO automático de notícias e vídeos

## Implementação

Geração determinística, sem IA, novas dependências ou migrações. Reutiliza `seo_title`, `seo_description`, os geradores de metadados existentes e o log de auditoria.

- O título usa o título editorial com uma única assinatura `UPOST.uy`, limitado por palavras. A descrição usa, nesta ordem, resumo, subtítulo, descrição, corpo e título; remove marcação, decodifica entidades e limita a 160 caracteres sem criar fatos.
- Notícias criadas/editadas e importações automáticas passam pela mesma geração no salvamento. Vídeos também geram/atualizam os campos ao salvar. Campos ausentes não exigem intervenção do jornalista.
- Na edição, valores reconhecidos como gerados pela rotina acompanham o conteúdo novo. Valores personalizados não vazios são preservados, inclusive quando o formulário omite os campos. Deixar um campo vazio retorna à geração automática.
- Legados não possuem indicação persistida de autoria dos campos SEO. Por segurança, valores não vazios desconhecidos são tratados como personalizados; não se presume que estejam errados apenas por serem curtos ou diferentes do título atual. Corrige-se o texto genérico conhecido “Noticias de Uruguay y el mundo”, campos vazios e a saída identificável da rotina, sem adivinhar a intenção editorial.
- Os campos opcionais foram recolhidos em **Opciones avanzadas**. Não existia prévia específica de SEO; a prévia editorial já existente foi preservada.
- Não foram adicionadas palavras-chave: o portal não possui esse campo. Categorias, duração e outros dados ausentes nos vídeos não são inventados.

## Renderização pública

Os metadados são resolvidos também na leitura. Assim, os registros antigos recebem fallback automático nas páginas públicas após publicar o código, mesmo antes do preenchimento autorizado no banco.

- Notícias: título, descrição, canonical existente ou URL local estável, OG de artigo, Twitter Cards e `NewsArticle` com autor, imagem e datas reais disponíveis. URLs canônicas personalizadas são preservadas.
- Vídeos individuais `/videos?video=ID`: título e descrição específicos, canonical próprio, OG `video.other`, Twitter Cards e `VideoObject` quando há miniatura e data de publicação reais. URLs de embed são derivadas de IDs válidos YouTube/Vimeo; arquivos MP4/WebM usam sua URL real. Sem duração inventada.
- Vídeos sem miniatura ou data conhecida continuam com os metadados básicos, sem declarar um objeto rico incompleto. Notícias sem imagem usam card textual e não ganham imagem fictícia.
- O sitemap passou a incluir URLs individuais de vídeos publicados. As consultas públicas excluem rascunhos, arquivados, excluídos e publicações futuras. Notícias continuam seguindo a view pública existente e suas regras de retenção.
- Os dados estruturados usam JSON escapado, incluindo proteção contra fechamento de `script` no conteúdo.
- A origem das URLs vem de `SITE_URL`, com padrão `https://upost.uy`. A prévia local está configurada como `http://localhost:3000`; por isso essa origem aparece nas evidências locais. A configuração de publicação deve usar `https://upost.uy`.

## Dry-run real — nenhuma atualização aplicada

Comando executado: `node scripts/backfill-seo.mjs --dry-run`.

| Conteúdo público | Examinados | Seriam alterados |
| --- | ---: | ---: |
| Notícias | 126 | 126 |
| Vídeos | 3 | 2 |
| Total | 129 | 128 |

Transações **READ ONLY**, sem alterações no Neon, conteúdo editorial, imagens, slugs, URLs ou R2. Evidência: `artifacts/seo/dry-run.jsonl`, com contagens, campos afetados e cursor de cada lote. Os números são um retrato da execução e podem mudar com novas publicações.

## Lotes e retomada

`scripts/backfill-seo.mjs` usa lotes de 50 (máximo 100), paginação por UUID e logs JSON por lote. A seleção de notícias usa a mesma view pública; vídeos usam os filtros públicos. Valores já adequados não são regravados.

```powershell
node scripts/backfill-seo.mjs --dry-run
node scripts/backfill-seo.mjs --dry-run --kind=news --after=UUID_DO_ULTIMO_LOTE --batch-size=50
```

**Somente após autorização específica para atualizar produção**, o mesmo comando admite `--apply` no lugar de `--dry-run`. A aplicação não foi executada nesta tarefa.

A escrita modifica apenas `seo_title`, `seo_description` e o contador `version`, e cria auditoria `seo.backfill`. Não muda `updated_at` nem datas editoriais. Cada atualização revalida publicação, versão e valores anteriores; conflitos são contados e podem ser tentados novamente, sem sobrescrever edições concorrentes. Erros revertem o lote; retoma-se do cursor do último lote confirmado. Uma nova execução completa também é segura e ignora registros já preenchidos.

## Arquivos desta etapa

- `lib/editorial/automatic-seo.mjs`: geração e preservação dos campos personalizados.
- `lib/editorial/seo.ts`: metadados públicos, imagens seguras e dados estruturados de vídeo.
- `lib/editorial/seo-backfill.mjs`: processamento comum em lotes.
- `server/services/editorial.ts` e `server/services/videos.ts`: integração nos salvamentos e consulta pública individual de vídeo.
- `app/(public)/noticias/[slug]/page.tsx`, `app/(public)/[section]/page.tsx` e `app/sitemap.ts`: renderização e indexação.
- `components/editorial/news-form.tsx` e `components/videos/video-form.tsx`: opções avançadas opcionais.
- `scripts/backfill-seo.mjs`, `scripts/check-public-seo.mjs` e `tests/automatic-seo.test.mjs`.
- Este relatório e evidências em `artifacts/seo/`.

## Validação e publicação

- **Seis testes direcionados aprovados**: limpeza/formatação, edição e preservação manual, backfill somente leitura/idempotente, metadados e ausência de dados inventados, salvamento real de notícia com importação automática e salvamento real de vídeo. Banco/R2 simulados nos testes de escrita.
- TypeScript e lint dos arquivos afetados aprovados. Não foi repetida a suíte inteira.
- Navegador real na prévia: uma notícia e um vídeo publicados com um único título, descrição, OG title e canonical; Twitter coerente; JSON-LD parseável e tipos corretos. Vídeo inexistente não indexável e sitemap com notícias e vídeos. Evidência: `artifacts/seo/public-validation.json`.
- Nenhuma migração é necessária para SEO. A migração 012 de retenção permanece pendente e intocada nesta etapa. Rádio, player, streaming, fullscreen, importações, retenção de 15 dias e serviço IA Marquesano não foram modificados.

Implementação validada e pronta para revisão/publicação. **Sem deploy realizado.** O preenchimento físico dos 128 registros no Neon permanece pendente de autorização específica; a renderização pública já possui fallback automático no código preparado.
