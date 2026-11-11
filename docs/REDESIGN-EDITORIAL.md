# UPOST — entrega para avaliação visual

**Registro da primeira proposta.** A composição visual e os números abaixo foram substituídos pela correção documentada em [CORRECAO-LAYOUT-VIDEOS.md](CORRECAO-LAYOUT-VIDEOS.md): a home atual usa 24 matérias, títulos contidos e estrutura compacta baseada na versão anterior. A política de 15 dias permanece preservada.

Implementação local, sem deploy, migrações aplicadas, exclusões de notícias ou alterações no R2/KVM.

## Resultado

- Home com até 35 matérias únicas: quatro destaques, seis de atualidade, seis em “Más noticias”, editorias reais e últimas manchetes. Edições pequenas exibem apenas o conteúdo disponível.
- Desktop com hierarquia tipográfica, três colunas principais, imagens de tamanhos diferentes, miniaturas e manchetes sem imagem; CSS Grid e divisórias finas.
- Mobile alterna destaque amplo, miniatura à esquerda, manchete sem imagem, miniatura à direita e imagens maiores. Manchetes longas permanecem em uma coluna.
- A consulta retorna no máximo 50 registros: 44 recentes, até cinco destaques e a escolha manual. A distribuição exibe no máximo 35, sem repetir matérias multicategoria.
- O bloco independente de notícias por fonte foi incorporado à edição geral para eliminar repetições. Os créditos, links das matérias e página de meios associados permanecem.
- Nova opção administrativa “Noticia principal de la portada (una sola)”, persistida em `settings.HOME_LEAD_NEWS_ID`. A importação automática não altera essa chave. O aviso de último momento permanece independente. Sem escolha manual válida, usa destaque editorial e depois a notícia recente.
- Atualidade, mais notícias e cada editoria mantêm ordem de publicação decrescente, com desempate por ID. A lista administrativa também deixa de ordenar por data de edição.
- Filtro público “Periodista” combinado com categoria e busca; paginação preserva o autor.
- Títulos da home e layout: “UPOST.uy | Periodistas en Red”, removendo a expressão repetida anterior.

Referências estudadas por capturas de navegador: [EL PAÍS América](https://elpais.com/america/) e [Globo.com](https://www.globo.com/). O acesso ao G1 não esteve disponível pelo navegador de pesquisa. Foram usados os princípios de hierarquia, alternância e separação editorial.

## Arquivos

| Área | Arquivos |
| --- | --- |
| Home | `app/(public)/page.tsx`, `app/(public)/home.module.css`, `components/home/editorial-edition.tsx` |
| Distribuição/consulta | `lib/editorial/distribution.mjs`, `server/repositories/editorial.ts` |
| Cards | `components/editorial/news-card.tsx` |
| Destaque manual | `components/editorial/news-form.tsx`, `server/services/editorial.ts`, `lib/editorial/types.ts` |
| Jornalistas | `components/editorial/public-news.tsx` |
| SEO | `app/layout.tsx` e metadados da home |
| Validação | `tests/distribution.test.mjs`, `scripts/check-editorial-home.mjs`, `scripts/preview-fifteen-day-retention.mjs` |
| Prévia isolada | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore` |
| Evidências | `artifacts/editorial/validation.json`, capturas `home-{largura}.png`, referências e recortes |

## Verificações

- `npm.cmd test`: 93 testes aprovados, incluindo distribuição, importações e garantias da lixeira/R2.
- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run lint`: zero erros; dois avisos preexistentes em `admin-session-guard.tsx` e `public-video-player.tsx`.
- `npm.cmd run build`: aprovado, compilação e rotas concluídas.
- `node scripts/check-editorial-home.mjs`: aprovado em 360, 390, 430, 768, 1024 e 1440 px. Em todas: 35 matérias, 35 IDs distintos, zero imagens quebradas, zero overflow horizontal e nenhum card com altura anormal. Testou também o envio e a persistência do filtro público por jornalista.
- Escolha manual, precedência sobre notícias urgentes/importadas, cronologia, multicategoria e limite de 35 cobertos nos testes de distribuição. A gravação administrativa não foi exercitada em produção.
- A prévia usou `PGOPTIONS=-c default_transaction_read_only=on`. As APIs de navegador foram interceptadas para evitar impressões publicitárias e analytics; por isso os banners pagos não aparecem nas capturas. Cabeçalho e rádios foram preservados.

Capturas para avaliar: [desktop](../artifacts/editorial/home-1440.png), [celular](../artifacts/editorial/home-390.png), [detalhe desktop](../artifacts/editorial/desktop-detail.png), [detalhe celular](../artifacts/editorial/mobile-detail.png).

## Retenção definitiva: 15 dias — ativação pendente

O prazo definitivo é de **15 dias completos (360 horas)** desde a data de publicação, tanto para novas notícias manuais quanto automáticas. `node scripts/preview-fifteen-day-retention.mjs` reutiliza o dry-run da rotina existente; não sincroniza fontes nem grava dados.

A migração `012_fifteen_day_retention.sql` foi preparada, **não aplicada**. Ela fixa a configuração em 360 horas e define o marco prospectivo. Notícias existentes não são inscritas retroativamente; notícias fixadas, permanentes e protegidas não expiram. A migração histórica 011 permanece imutável por checksum e é substituída pela 012 quanto à política vigente.

Após a ativação revisada, a view pública retira as novas notícias elegíveis ao completar 15 dias. A rotina existente envia à lixeira e assegura o período completo de recuperação a partir dessa retirada (sete dias por padrão). A eliminação definitiva continua desativada até habilitação explícita, com verificação de propriedade R2 e referências compartilhadas. Restauração mantém borrador protegido. Não houve exclusões reais nem deploy. Ver detalhes e validação atualizados em `docs/RETENCION-NOTICIAS.md`.

## Reproduzir a prévia

PowerShell, em um terminal local:

```powershell
$env:PGOPTIONS='-c default_transaction_read_only=on'
$env:UPOST_EDITORIAL_PREVIEW='1'
node node_modules/next/dist/bin/next dev -p 3105
```

Em outro terminal: `node scripts/check-editorial-home.mjs`. A configuração padrão de build e produção permanece `.next`; a variável de prévia usa `.next-editorial-preview`. O serviço da porta 3000 não foi interrompido.
