# UPOST — “Más noticias” por categorias e vídeos restaurados

## Alterações limitadas à home

- Mantidos a faixa principal aprovada, sete destaques, dimensões dos cards, tipografia, imagens e cantos arredondados.
- “Más noticias” agora apresenta grupos das categorias **reais e ativas** vinculadas às matérias: Uruguay, Mundo e Deportes primeiro, seguidas das demais editorias existentes. Só são mostrados grupos com conteúdo nesta página.
- Cada grupo usa os mesmos `NewsCard` e a mesma grade, com apenas nome da editoria, linha discreta, espaçamento moderado e link para `/noticias?category=SLUG`.
- Cada matéria aparece em um único grupo. Em múltiplos vínculos, a prioridade de categorias define a primeira alocação. Dentro de cada grupo, a publicação mais recente vem primeiro, com desempate por ID. Matérias sem categoria exibível permanecem no bloco geral, sem inventar categoria.
- Continua a paginação já implementada: lotes de 32 notícias além dos destaques, sem teto total de 24 ou 35. Não foram alteradas consultas de notícias nem registros de categorias.
- O componente existente `HomeVideos` e a consulta `publishedVideos({home:true})` foram reconectados. Até três publicados recentes, sem rascunhos ou autoplay, com links individuais e “Ver más videos”. Se não houver vídeos, a seção não aparece.
- O diretório genérico de Videos/Podcast foi retirado da home. Rotas, menu, rodapé e sistema de podcasts não foram alterados.

## Arquivos desta tarefa

- `lib/editorial/distribution.mjs`: agrupamento por categorias reais, sem limite por grupo e sem duplicação.
- `components/home/editorial-edition.tsx`: apresentação dos grupos dentro de “Más noticias”.
- `app/(public)/home.module.css`: três regras novas, restritas aos separadores das categorias; estilos dos cards e destaque preservados.
- `app/(public)/page.tsx`: restauração do componente de vídeos e remoção do diretório de podcasts.
- `tests/distribution.test.mjs`: verificação de ordem, categorias, múltiplos vínculos e ausência de teto artificial.
- `scripts/check-category-home.mjs`: validação real e capturas.
- Este relatório e evidências em `artifacts/editorial/category-home-*`.

## Validação

- Cinco testes de distribuição e o teste direcionado da consulta de vídeos aprovados. TypeScript e lint dos arquivos afetados aprovados. Não foi repetida a suíte completa.
- Navegador real em 1440 e 390 px: **42 notícias distintas**, zero overflow e zero imagens quebradas. Grupos observados: Uruguay (12), Mundo (9), Deportes (2) e Tecnología (9), além dos sete destaques e três matérias das fontes.
- Confirmados os vínculos reais de cada card com seu grupo e a ordem cronológica decrescente.
- Colunas, gap, largura/raio do destaque, tamanho da manchete e raio da imagem coincidem com a base visual aprovada, nas duas resoluções.
- Três vídeos em três colunas no desktop e duas no celular; proporções medidas em 16:9; link individual abre o player existente. Sem seção de podcasts na home.
- APIs de gravação e analytics bloqueadas durante a validação. Nenhuma escrita no Neon/R2, migração, deploy ou alteração do player, galeria, SEO, rádio, retenção ou importações.

Capturas: [desktop](../artifacts/editorial/category-home-1440.png), [celular](../artifacts/editorial/category-home-390.png), [Videos desktop](../artifacts/editorial/category-home-videos-1440.png), [Videos celular](../artifacts/editorial/category-home-videos-390.png).

Medições: `artifacts/editorial/category-home-validation.json`. O anexo recebido termina em “6. EXECUÇÃO — Mod”; foram atendidos os requisitos completos disponíveis no arquivo.
