# UPOST — correção da home e vídeos

Implementação local, sem deploy, alteração de banco, migração aplicada ou escrita no R2.

## Referência anterior identificada

O histórico disponível termina em `2d6c56a` (Medios Públicos), precedido por `d83d721` e `233c40c`. A reformulação recente estava na árvore de trabalho, sem commit. Foram comparados `app/(public)/page.tsx` e `home.module.css` de `HEAD` com a implementação recente antes das alterações. A referência recuperada é o destaque fotográfico acompanhado de notícias horizontais compactas, com títulos contidos. Não foi usado reset nem reversão de funcionalidades.

## Correções

- Home limitada a **24 notícias únicas**, em vez de preencher a página com 35. Destaque principal e coluna de três secundárias compactas; atualidade, mais notícias e editorias com unidade visual.
- Eliminadas as linhas com cards atravessando várias linhas da grade e a alternância arbitrária entre formatos. Títulos secundários de 18–20 px e até três linhas; principal de 27–32 px. Sem alturas fixas para os cards.
- Fotografias existentes são priorizadas nos espaços visuais. A escolha manual do principal é preservada mesmo quando a matéria não tem imagem; nesse caso, aparece em texto compacto e a grade se reorganiza. Imagens não são ocultadas arbitrariamente em matérias que possuem foto.
- URLs identificadas como logotipos, placeholders, SVG/ICO e alt de logotipo não ocupam espaços fotográficos. Não houve geração ou substituição fictícia de fotos. Imagens usam proporção reservada e `object-fit: contain`, preservando todo o enquadramento.
- Mobile: principal com imagem proporcional e secundárias horizontais com miniaturas, sem colunas estreitas de manchetes longas.
- Galeria: grade de quatro posições no desktop e duas no celular, miniaturas 16:9, títulos de duas linhas, datas discretas e botão visual de reprodução de 30 px.
- O repositório não possuía uma rota pública individual de vídeo nem sidebar: renderizava um player em cada item da galeria. A seleção agora abre `/videos?video=ID`, com o **mesmo PublicVideoPlayer**, sem mudanças no streaming, fullscreen ou lógica de reprodução. Relacionados: coluna de 260 px no desktop, miniaturas de 88 px e lista horizontal compacta; abaixo do player até 900 px de largura. Nenhum vídeo de teste foi publicado.

## Arquivos desta correção

- `app/(public)/home.module.css`
- `components/home/editorial-edition.tsx`
- `lib/editorial/distribution.mjs`
- `app/(public)/[section]/page.tsx`
- `components/videos/public-videos.tsx`
- `components/videos/public-videos.module.css`
- `tests/distribution.test.mjs`
- `scripts/check-editorial-home.mjs`
- `scripts/check-public-videos.mjs`
- Este relatório e evidências em `artifacts/editorial/`.

Importações/RSS, Medios Públicos, escolha administrativa do principal, filtro por jornalista, cronologia, SEO, retenção de 15 dias, autenticação, permissões, rádio e player não foram revertidos. A migração de retenção 012 continua pendente de aplicação, como na entrega anterior.

## Validação

- Quatro testes de distribuição aprovados: quantidade, unicidade, ordem, prioridade fotográfica, principal manual e edição vazia.
- TypeScript (`tsc --noEmit`) e lint dos arquivos alterados aprovados. Não foi repetida a suíte completa.
- Home real em 360, 390, 430, 768, 1024 e 1440 px: 24 matérias únicas, sem overflow, imagens quebradas ou cards com altura anormal. Filtro público por jornalista novamente verificado.
- Galeria real com os três vídeos publicados: duas posições lado a lado no celular e grade de quatro posições no desktop (apenas três ocupadas pelo conteúdo existente). Capturas nas seis larguras.
- Seleção individual validada em 390, 768, 1024 e 1440 px: um player principal, relacionados abaixo no celular/tablet e sidebar de 260 px no desktop, sem overflow. Não foi iniciado streaming durante os testes.
- APIs de gravação e analytics bloqueadas nas verificações de navegador. Banners pagos e indicadores dinâmicos podem aparecer vazios nas capturas por esse motivo. O rádio fixo existente permanece visível.

Capturas: [home desktop](../artifacts/editorial/home-1440.png), [home celular](../artifacts/editorial/home-390.png), [galeria celular](../artifacts/editorial/videos-390.png), [vídeo individual desktop](../artifacts/editorial/video-selected-1440.png), [vídeo individual celular](../artifacts/editorial/video-selected-390.png).

O anexo recebido termina em “10. VALIDAÇÃO VISUAL OBR”. A validação foi feita conforme as larguras já solicitadas nesta conversa.
