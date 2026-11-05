# Rádio na coluna de 30% da homepage

A homepage agora usa os 70% à esquerda para o carrossel existente e os 30% à direita
para a Radio Mix Artigas ativa no cadastro. O card tem logotipo oficial, identificação
“Radio en vivo”, Play/Pause, estado de conexão e volume. Não inicia áudio automaticamente.

Alturas preservadas do banner: 168 px no desktop e 150 px no tablet. O card acompanha
exatamente essas alturas. No celular, aparece abaixo do banner, com altura de 136 px,
sem rolagem horizontal.

A seção inferior “Radios en vivo” foi removida integralmente da homepage. A barra fixa
inferior também não é renderizada nessa página, e seu recuo inferior foi retirado.
Há somente um card de rádio na homepage e um único elemento de áudio compartilhado.

O provedor de áudio continua no layout público. Em notícias e `/radios`, a barra
persistente segue disponível; trocar de página não recria o áudio nem a conexão.
Recarregar completamente a página continua interrompendo a sessão, sem autoplay.

Enquanto a rádio ocupa a coluna direita, a homepage consulta apenas o inventário do
carrossel. As campanhas laterais existentes não são excluídas, alteradas ou registradas
como exibidas atrás do card. Se a rádio deixar de estar ativa/disponível no cadastro,
a apresentação publicitária anterior permanece como fallback.

## Validação

- Geometria em 1440, 1024, 768 e 390 px: 70/30, alturas, espaçamento e ausência de overflow.
- Homepage: um card, um áudio, sem seção inferior nem barra fixa duplicada.
- Reprodução AAC real: Play/Pause e volume pelo card em desktop e celular.
- Navegação até notícia e `/radios`: mesmo áudio e uma requisição de streaming.
- Falha de conexão: mensagem de erro recuperável, sem autoplay.
- Rotação do banner e suas interações preservadas.
- TypeScript, ESLint, testes existentes e build executados.

## Arquivos principais

- `app/(public)/page.tsx`
- `components/ads/top-banners.tsx` e `top-banners.module.css`
- `components/radio/radio-station-card.tsx`, `radio-player.tsx`, `radio-player.module.css`
- `app/api/ads/top/route.ts` e `server/services/ads.ts` (seleção opcional só do carrossel)
- Testes em `tests/header/` e `tests/radio/live-radio.spec.ts`.

Nenhum cadastro ou schema do banco foi alterado. Cabeçalho, logotipo, MarketTicker,
carrossel principal e notícias preservados. Sem push, deploy ou mudanças na Biosfera.
