# UPOST — restauração da home conforme produção

## Referência e preservação

A referência foi **https://upost.uy**, aberta e capturada diretamente no navegador nesta tarefa, em 1440 e 390 px. Não foram usadas as tentativas anteriores como referência de design. A estrutura observada e os valores dos estilos correspondem aos arquivos originais disponíveis em `HEAD` (`2d6c56a`): destaque com seis secundárias, grade de “Más noticias”, editorias, fontes e diretório Videos/Podcast.

Antes das alterações, foram salvos o diff binário de todos os arquivos rastreados e os arquivos não rastreados. Backup verificado com 53 arquivos em `artifacts/backups/before-original-home-1794369696423.zip`. Não houve reset, clean ou descarte geral da árvore de trabalho.

## Alterações seletivas

- Restauradas as colunas, proporções, tipografia, raios, espaçamentos e componentes de notícia da produção. Removidos os formatos experimentais de atualidade e as substituições de aparência aplicadas na home.
- Mantidos o componente de edição/renderização já existente e a geração de metadados nova. Nenhum novo componente visual foi criado.
- O bloco de três vídeos acrescentado nas tentativas anteriores saiu da home. Foi recuperado o diretório original de links Videos/Podcast, como na produção. Os arquivos desse bloco foram preservados; a galeria, a visualização individual, os relacionados, links, player e consultas de vídeo permanecem implementados.
- O conteúdo aumentou dentro da grade original, usando a paginação existente. Permanecem sete destaques; as demais notícias são consultadas em lotes de 32 por página, com contagem e links para as páginas seguintes. **Não há teto total de 24 ou 35 notícias** e não é carregado o banco inteiro.
- A seleção manual do principal tem precedência; atualidade mantém ordenação por publicação com desempate estável. As editorias originais são preservadas. Notícias multicategoria não se repetem; o bloco de fontes exclui os IDs já exibidos e elimina repetições entre fontes.
- Nos vídeos, a única alteração desta tarefa foi `border-radius:12px` no card e na miniatura, com `overflow:hidden`. Nenhuma dimensão, coluna, fonte, player ou lógica de reprodução foi modificada.

## Arquivos desta tarefa

| Arquivo | Alteração |
| --- | --- |
| `app/(public)/home.module.css` | Estilos originais da home |
| `components/home/editorial-edition.tsx` | Marcação original, com os mesmos NewsCards |
| `app/(public)/page.tsx` | Composição original, paginação e fontes; SEO preservado |
| `lib/editorial/distribution.mjs` | Sete destaques, editorias originais, remoção do teto de conteúdo |
| `server/repositories/editorial.ts` | Consultas paginadas e exclusão de duplicatas nas fontes |
| `components/editorial/source-news.tsx` | Recebe os IDs já exibidos |
| `components/videos/public-videos.module.css` | Somente raios de 12 px e recorte dos cantos |
| `tests/distribution.test.mjs` | Expectativas da distribuição original, sem teto artificial |
| `scripts/check-original-home.mjs` | Comparação real produção/local |
| Este relatório e `artifacts/editorial/original-*` | Evidências |

## Validação

Comparação automatizada e inspeção visual das capturas em ambas as resoluções:

- Mesmos valores de colunas, gaps, famílias e tamanhos de fonte, larguras dos cards, raios e proporção da imagem principal na produção e na restauração local.
- Desktop: colunas `474.297px 364.844px 364.844px`, gap 18 px, manchete Georgia 34 px, imagem principal com raio de 14 px e miniaturas de 12 px.
- Celular: coluna de 354 px dentro do viewport de 390 px, gap 16 px, manchete de 28 px e os mesmos raios da produção.
- Sem overflow ou imagens quebradas.
- Produção: 16 exibições de notícias (14 distintas, pois havia repetição no bloco de fontes). Local: **42 notícias distintas na primeira página**, incluindo fontes, e paginação para o restante. A segunda página mostrou conteúdo diferente, e o link individual de notícia respondeu 200.
- Quatro testes direcionados de distribuição, TypeScript e lint aprovados. Não foi repetida a suíte inteira.

As APIs de navegador e analytics foram bloqueadas para impedir gravações. Os banners/indicadores dinâmicos podem não aparecer nas capturas; o tratamento foi o mesmo na produção e na prévia. A barra fixa de rádio foi preservada. O indicador de desenvolvimento do Next aparece somente na prévia.

## Capturas comparativas

Produção à esquerda; restauração local à direita:

- [Comparação desktop](../artifacts/editorial/original-side-by-side-1440.png)
- [Comparação celular](../artifacts/editorial/original-side-by-side-390.png)

Capturas completas: `original-production-1440.png`, `original-local-1440.png`, `original-production-390.png` e `original-local-390.png`, em `artifacts/editorial/`. Medições em `original-comparison.json`.

SEO automático, filtro por jornalista, principal manual, importações, Medios Públicos, retenção de 15 dias, administração, autenticação, rádio, Neon e R2 foram preservados. A migração 012 não foi aplicada. Não houve alteração de dados reais, cron, KVM ou deploy.
