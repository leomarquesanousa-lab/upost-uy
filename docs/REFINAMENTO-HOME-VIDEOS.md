# UPOST — refinamento da home e vídeos

Mantida a composição anterior: 24 notícias únicas, principal manual, mesma distribuição cronológica e mesmas editorias. Não houve novo redesign, deploy, migração aplicada ou alteração de dados/R2.

## Alterações

- Ajustes pontuais de hierarquia: manchete principal até 30 px no desktop e 26 px no celular; secundárias de 19/18 px. O limite mobile permite até quatro linhas em fonte menor, reduzindo cortes agressivos. Títulos de seção de 23 px, categorias menores e cor discreta, alinhamentos e espaçamento consistentes.
- Nova seção **Videos**, após os blocos de notícias, com linha divisória, miniaturas 16:9, ícones pequenos, datas discretas, títulos de duas linhas e **Ver más videos**.
- Consulta existente `publishedVideos({home:true})` agora possui modo de home: apenas publicados, não excluídos e sem data futura, ordenados por publicação decrescente, com desempate estável e `LIMIT 3`. Não usa prioridade de destaque nesse modo. A consulta padrão da galeria conserva a preferência pelos destacados.
- O card foi extraído da própria galeria como `PublicVideoCard`, compartilhado pela home. Os links abrem `/videos?video=ID`, onde permanece o `PublicVideoPlayer` existente. Não há player, iframe ou autoplay na home, nem cópia de arquivos.
- Quando não existem vídeos publicados, `HomeVideos` retorna `null`, sem título, espaço ou seção vazia.
- Retirado somente o diretório de Podcast da home. Menu, rodapé, rotas, dados e funcionalidades de podcasts foram preservados. O link genérico de Videos no mesmo diretório foi substituído pela seção real de vídeos.
- Importações, Medios Públicos, filtro por jornalista, SEO, rádio, controles administrativos e retenção de 15 dias permanecem. A migração 012 **não foi aplicada**.

## Arquivos desta etapa

- `app/(public)/page.tsx`
- `app/(public)/home.module.css`
- `components/home/home-videos.tsx`
- `components/home/home-videos.module.css`
- `components/videos/public-videos.tsx`
- `server/services/videos.ts`
- `tests/home-videos.test.mjs`
- `scripts/check-editorial-home.mjs`
- Este relatório e capturas/medições em `artifacts/editorial/`.

## Validação

- Teste direcionado da consulta aprovado: publicados, exclusões, datas futuras, ordem, limite de três e preservação do comportamento da galeria. Banco simulado, sem gravações.
- TypeScript e lint dos arquivos afetados aprovados. A suíte completa não foi repetida.
- Navegador real em 360, 390, 430, 768, 1024 e 1440 px: 24 notícias/24 IDs distintos, sem overflow horizontal, imagens quebradas ou cards com altura anormal.
- Home real com três vídeos publicados: três na primeira linha em 1440 px; dois na primeira linha em 390 px; proporção 16:9 medida em todas as miniaturas e títulos limitados a duas linhas.
- Links individuais abrem um único player na página de destino; galeria continua acessível. Filtro por jornalista novamente verificado.
- APIs de navegador e analytics interceptadas durante os testes para impedir gravações. Banners e indicadores dinâmicos podem não aparecer nas capturas; o rádio existente foi preservado.
- As quatro capturas foram geradas e inspecionadas visualmente. O anexo recebido termina em “Funcionamento dos”; foram verificados os links dos vídeos e da galeria conforme os requisitos disponíveis.

## Capturas atuais

- [Homepage desktop, 1440 px](../artifacts/editorial/home-1440.png)
- [Homepage celular, 390 px](../artifacts/editorial/home-390.png)
- [Seção Videos desktop](../artifacts/editorial/home-videos-1440.png)
- [Seção Videos celular](../artifacts/editorial/home-videos-390.png)

Medições: `artifacts/editorial/validation.json`. Nenhuma alteração no serviço IA Marquesano ou configuração do KVM.
