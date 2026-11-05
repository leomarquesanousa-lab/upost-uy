# Topo do UPOST — implementação

## Composição

Faixa preta com data `es-UY`/`America/Montevideo`, cabeçalho branco com o logo
oficial centralizado, menu suspenso preservado, MarketTicker vermelho `#A71922`
com 34 px, banners opcionais e notícias. A barra horizontal secundária foi removida
do HTML e seus estilos foram eliminados. As rotas e os grupos do menu continuam iguais.

## Dados financeiros

Fonte: [API datosUruguay](https://datosuruguay.com/api), com links de atribuição
por indicador e link permanente para datosUruguay, sob CC BY 4.0.

| Indicador | Endpoint | Cache no servidor |
| --- | --- | --- |
| USD / EUR / BRL / ARS BROU | `/exchange-rates/{moeda}/quote` | 10 minutos |
| Unidad Indexada | `/indexed-units/ui?limit=10` | 1 hora |
| IPC nacional, variação em 12 meses | `/inflation?limit=2` | 6 horas |

O navegador consulta apenas `/api/market`, inicialmente e a cada 10 minutos enquanto
visível. Não consulta diretamente a fonte. O servidor combina cache persistente do
Next com coalescência por processo; falhas têm espera mínima de 60 segundos e respeitam
`Retry-After` em segundos. Cada consulta tem timeout de 4 segundos, independente das
demais. A homepage renderiza sem aguardar a API externa.

BROU informa frequência aproximada de 10 minutos; UI tem referência diária e IPC mensal.
Isso não significa dados em tempo real. Cada valor mostra a referência da própria fonte.
UI ignora datas futuras já publicadas e escolhe o último dia vigente em Montevideo.
IPC usa `annual_12m_total_country`, sem confundir percentual com nível do índice ou
séries regionais. Nenhum valor é fixado no código de produção.

Falhas parciais não removem os indicadores válidos; ausência total mostra mensagem
discreta. Movimento contínuo pode ser pausado por botão, mouse ou foco. Com movimento
reduzido, o ticker fica estático e permite rolagem horizontal interna, sem alargar a página.

## Integração com publicidade existente

- `HOME_TOP`: carrossel de campanhas ativas, ordenadas por prioridade descendente,
  com desempate estável por ID; até 12 campanhas por resposta.
- `HOME_SIDEBAR`: publicidade adjacente, usando seleção por prioridade e rotação
  de empates já existentes.
- Mesmos `ad_slots`, `ad_campaigns`, uploads, agendamentos, permissões administrativas,
  recibos, URLs de clique e registro idempotente de impressões.
- `AdCreative` compartilha renderização e rastreamento entre os banners novos e antigos.
  Uma impressão exige imagem carregada e pelo menos 50% visível por um segundo.
- Rota `/api/ads/top` consulta o inventário uma vez por minuto por página visível.
  Sem campanhas elegíveis, não cria recibos nem executa limpeza no banco.
- Sem banners, a área pública desaparece; sem anúncio lateral, carrossel ocupa toda
  a largura. Desktop/tablet: 70/30 e 120 px; celular: pilha com 100 px por área ativa.
- Imagens usam `object-fit: contain`, com versão móvel opcional e sem recortar textos.
  Recomenda-se enviar artes adequadas a cada espaço: cerca de 850×120 para carrossel,
  350×120 para lateral e 400×100 para celular, ou múltiplos dessas dimensões.
- Carrossel troca a cada 6 segundos, pausa em hover, foco, aba oculta e interação manual.
  Pode ser retomado por botão. Movimento reduzido desabilita rotação automática.

### Configuração administrativa pendente

Na consulta de leitura realizada nesta tarefa, o banco UPOST tinha cinco posições
legadas e nenhuma campanha. `HOME_TOP` e `HOME_SIDEBAR` estavam ausentes: a migração
009 que os prevê não foi executada.

O painel existente `/admin/publicidade` agora oferece botões para cadastrar somente
essas posições faltantes, após ação explícita do administrador autenticado. Isso usa
o schema atual, sem migração. Se elas já existirem, os botões desaparecem. Ativação,
edição de campanhas e ordenação por prioridade continuam no mesmo gerenciador.

Nenhuma posição ou campanha foi cadastrada automaticamente. Para exibir banners
reais, o administrador deve configurar as posições e cadastrar as artes/campanhas.

## Verificação

As capturas `real-top-*.png` usam os indicadores reais e nenhum anúncio inventado.
As capturas `fixture-top-*.png` usam respostas e artes interceptadas exclusivamente
no Playwright, marcadas “PRUEBA VISUAL · NO PUBLICADA”, para testar 70/30 e controles
sem gravar anúncios ou arquivos públicos. Não são conteúdo do portal.

Testes em 1440, 1024, 768 e 390 px verificam centralização, ausência da barra antiga,
menu/busca/teclado, dimensões, rotação, pausa, movimento reduzido e ausência de overflow.
O conjunto existente de notícias também verifica homepage e leitura das cinco matérias.

Sem migrações executadas, alterações de credenciais, DNS, push ou deploy. Biosfera preservada.

## Arquivos desta alteração

- Cabeçalho: `components/layout/public-header.tsx`, `public-header.module.css`,
  `public-shell.tsx`, `market-ticker.tsx`, `market-ticker.module.css`.
- Indicadores: `lib/market.mjs`, `server/services/market.ts`, `app/api/market/route.ts`.
- Banners: `components/ads/creative.tsx`, `banner.tsx`, `top-banners.tsx`,
  `top-banners.module.css`, `server/services/ads.ts`, `app/api/ads/top/route.ts`.
- Painel: `components/admin/ad-form.tsx`, `app/admin/operations-actions.ts`,
  `app/admin/(protected)/publicidade/page.tsx`.
- Homepage: `app/(public)/page.tsx`, `app/(public)/home.module.css`.
- Verificação: `tests/market.test.mjs`, `tests/market-service.test.mjs`,
  `tests/header/top.spec.ts`, além deste documento.
