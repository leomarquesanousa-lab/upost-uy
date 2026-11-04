# Documentação técnica — Portal Biosfera Rádio TV Web

## Estado e escopo

Fases 1 e 2: fundação técnica e núcleo editorial. Projeto Next.js existente preservado, com PostgreSQL no Neon via `pg`, migrations SQL próprias, autenticação por sessão, OWNER existente e rádio persistente. Não houve recriação da Fase 1, mudança de autenticação, ORM, scraping, integração automática de notícias, deploy, DNS ou alteração no portal atual.

O núcleo editorial oferece categorias, autores independentes de contas administrativas, notícias, editor, publicação, agendamento, arquivamento, capa, SEO, destaques, busca e auditoria. Não são gerados conteúdos fictícios no banco da aplicação.

## Stack e organização

- Next.js 16.3.6, App Router, React, TypeScript e Tailwind existentes.
- PostgreSQL e `pg`; `@types/pg` para tipagem.
- `marked`: parser Markdown; `sanitize-html`: lista permitida de HTML; `sharp`: validação e conversão de imagens. Tipos do sanitizador em desenvolvimento.
- Node Crypto: scrypt, tokens e hashes. Playwright: testes de navegador.

```
app/(public)/                   Home e páginas públicas
app/(public)/noticias/           Listagem e notícia individual
app/(public)/busca/              Busca editorial
app/admin/(protected)/          Dashboard e administração editorial
app/admin/editorial-actions.ts  Mutações autenticadas
app/api/editorial/upload/       Upload autenticado
app/media/[filename]/           Entrega de imagens locais
app/sitemap.ts, app/robots.ts    Descoberta e indexação
components/editorial/           Formulários, editor, cards e listagens
components/radio/               Player persistente original
lib/auth/                       Sessão e permissões editoriais
lib/editorial/                  Validação, tipos, sanitização, SEO e imagem
lib/db/                         Pool PostgreSQL
server/repositories/            Consultas editoriais
server/services/                Escritas transacionais, storage e settings
storage/uploads/                Imagens de runtime, ignoradas pelo Git
scripts/                        Migration, bootstrap e testes
database/migrations/           SQL numerado (sem ORM)
tests/                          Unitários e E2E
```

`app/` e alias `@/*` continuam na raiz. Não foi criada outra aplicação ou um CMS externo.

## Ambiente e execução

| Variável | Uso |
| --- | --- |
| DATABASE_URL | PostgreSQL da aplicação; configuração atual do Neon preservada |
| SITE_NAME | Nome do portal, fallback de settings |
| RADIO_STREAM_URL | Stream HTTPS, fallback de settings |
| SITE_URL | Origem absoluta para canonical, Open Graph, JSON-LD e sitemap; padrão local http://localhost:3000 |
| UPLOAD_DIR | Diretório persistente de uploads; padrão storage/uploads |
| ADMIN_INITIAL_OWNER_NAME | Apenas bootstrap inicial |
| ADMIN_INITIAL_OWNER_EMAIL | Apenas bootstrap inicial |
| ADMIN_INITIAL_OWNER_PASSWORD | Apenas bootstrap, de 12 a 256 caracteres |
| TEST_DATABASE_URL | PostgreSQL local exclusivo para testes, com permissão CREATEDB |

`.env*` está ignorado; apenas `.env.example` pode ser versionado. Não imprimir conexões, senhas, hashes ou tokens. Nunca configurar credenciais como `NEXT_PUBLIC_*`. Não sobrescrever `.env.local` existente. `SITE_URL` usa uma origem HTTP(S), sem credenciais. Em eventual implantação futura, deve receber a origem final correta; nenhum domínio foi alterado nesta fase.

```shell
npm install
npm run db:migrate
npm run dev
```

No Windows com ExecutionPolicy restritiva, use `npm.cmd`. `npm run build` gera produção local e `npm start` a executa. Não equivale a deploy.

Em instalação nova, preencha `ADMIN_INITIAL_OWNER_*`, execute `npm run db:bootstrap` e remova as variáveis. O script mantém o OWNER existente sem duplicar ou redefinir senha. O OWNER já criado no Neon não é alterado por esta fase.

## Migrations e banco

`001_foundation.sql` permanece intacta. Contém users, sessions, settings, audit_log e login_attempts. `schema_migrations` registra nome, checksum e execução. O runner mantém ordem lexical, lock de concorrência e uma transação por migration. Migration aplicada não deve ser editada; alterações exigem novo arquivo numerado.

`002_editorial_core.sql` cria:

| Estrutura | Conteúdo |
| --- | --- |
| categories | UUID, nome, slug único, descrição, ativo e timestamps |
| authors | UUID, nome, slug único, biografia, photo_url, ativo e timestamps |
| news | Campos editoriais, capa/alt/legenda/crédito, autor, status/datas, destaque, SEO/canonical, criador/editor e timestamps |
| news_categories | Relação N:N, chave composta, referência a notícia e categoria |
| media_assets | Caminho WebP, tipo, tamanho, usuário responsável e data |
| public_news (view) | Notícias efetivamente públicas conforme status e instante atual |

`news.version` controla edição concorrente: salvar formulário antigo não sobrescreve alterações mais recentes. IDs são UUIDs do Node. Datas usam `timestamptz`. Índices cobrem autor, status/datas, destaque, categoria e busca textual GIN em português. SQL recebe valores parametrizados; nomes de tabelas e colunas dinâmicos são definidos apenas pelo servidor.

## Categorias e autores

OWNER e ADMIN criam, editam, ativam, desativam e excluem registros não vinculados. Slug sugerido a partir do nome, editável, único e composto de letras minúsculas sem acento, números e hífens. Duplicidade retorna erro legível.

Exclusão de autor ou categoria com notícias é impedida por chave estrangeira. A alternativa é desativar. Registros inativos deixam de ser opções para novos vínculos; vínculos existentes podem ser mantidos na edição. Desativar não retira a notícia do ar: arquive a notícia para isso. Categorias inativas deixam de aparecer na navegação pública. A autoria histórica permanece visível. Autores editoriais não são usuários administrativos.

## Notícias e fluxo editorial

Toda notícia exige título, slug, corpo textual, autor e entre 1 e 20 categorias. Capa é opcional; quando presente, exige texto alternativo. Resumo/subtítulo e SEO são opcionais. O slug pode ser alterado; isso muda a URL e não cria redirecionamento automático nesta fase.

Campos de criação/edição: título, slug, subtítulo, resumo, conteúdo, autor, categorias, capa, alt, legenda, crédito, status, publicação, agendamento, destaque, título/descrição SEO e canonical. Cada gravação da notícia, relações e auditoria ocorre na mesma transação.

| Status | Visibilidade |
| --- | --- |
| DRAFT | Nunca público |
| PUBLISHED | Público somente com published_at menor ou igual ao instante do banco |
| SCHEDULED | Público somente com scheduled_at menor ou igual ao instante do banco |
| ARCHIVED | Não aparece em home, busca, listagem, sitemap ou página individual |

Datas do formulário são explicitamente UTC e são enviadas como ISO 8601. Publicada sem data usa o momento atual. Publicação futura exige Agendada. Uma data agendada passada significa disponibilização imediata e é indicada no formulário. Uma notícia agendada cujo horário chegou continua armazenada como SCHEDULED e aparece como “No ar” no painel; a view decide a visibilidade sem cron ou escrita em GET. O evento de agendamento é auditado no salvamento, sem evento artificial de publicação gerado pela leitura pública.

Não existe hard delete de notícias: use Arquivada. O histórico fica preservado. O destaque só aparece quando a notícia está efetivamente pública. Na Fase 2.1, a home seleciona duas notícias públicas, priorizando destaques e depois a data de visibilidade; mostra até seis recentes adicionais sem repetir as duas principais.

## Permissões e autenticação

| Role | Notícias/publicação/agendamento/arquivo/upload | Categorias e autores | Usuários/configurações críticas |
| --- | --- | --- | --- |
| OWNER | Total | Total | Módulos futuros; nenhum novo acesso implementado |
| ADMIN | Total | Total | Módulos futuros |
| EDITOR | Criar, editar, publicar, agendar, destacar e arquivar | Somente leitura | Sem operações disponíveis |

Todas as páginas privadas consultam a sessão; cada mutação verifica sessão ativa e role novamente no servidor. A interface não é a fronteira de segurança. O upload também exige sessão e origem válida. As Server Actions mantêm proteção de origem do Next.js e checagem explícita Origin/Host.

Sessões da Fase 1 permanecem: scrypt assíncrono (N=32768, r=8, p=1, salt aleatório), token aleatório de 32 bytes, apenas SHA-256 no banco, cookie HttpOnly/SameSite=Lax/Secure em produção com prefixo `__Host-`, validade absoluta de 8 horas. Inativos não autenticam nem usam sessões anteriores. Logout revoga no banco. Rate limit de login: 5 tentativas por e-mail em 15 minutos.

## Editor e segurança do conteúdo

Editor Markdown com botões de negrito, itálico, títulos H2/H3, links, listas, citações e envio de imagens do corpo. Parágrafos usam linha em branco; quebra simples é preservada. Há prévia explícita no servidor usando o mesmo renderizador público.

O banco guarda Markdown para edição. Todo HTML resultante é sanitizado no servidor na prévia e em cada renderização pública. A lista permitida exclui scripts, iframes, SVG, handlers de eventos, estilos arbitrários e URLs executáveis. Imagens do corpo só aceitam URLs locais de mídia validadas; não há embeds arbitrários. Isso permite manter o texto original sem torná-lo HTML executável.

Referências consultadas: [Marked](https://marked.js.org/), [sanitize-html](https://github.com/apostrophecms/sanitize-html) e [Sharp](https://sharp.pixelplumbing.com/api-constructor/). O parser Markdown sozinho não sanitiza o conteúdo.

## Uploads e storage

`POST /api/editorial/upload` recebe o arquivo como corpo binário. MIME e extensão devem combinar: JPEG, PNG ou WebP. O limite de 5 MB é aplicado ao Content-Length e à leitura incremental, inclusive sem esse header. Sharp decodifica os bytes, valida o formato real, limita a 20 megapixels e rejeita formatos/arquivos inválidos. O arquivo é orientado, reduzido a no máximo 2400×2400 sem ampliação, convertido para WebP e gravado com nome UUID. SVG, executáveis e uploads arbitrários não são aceitos.

Nome original não determina caminho no disco. `server/services/storage.ts` concentra store/read/discard, preparando troca futura por storage/CDN. Imagens são entregues em `/media/[filename]` com formato fixo, `nosniff`, cache imutável e validação estrita do nome. São arquivos de runtime e ficam fora do bundle e do Git; não devem ser tratados como assets empacotados no build.

`media_assets` e `media.upload` registram o envio. Falha no registro descarta o arquivo criado. Retirar a imagem do formulário desfaz o vínculo, sem apagar um arquivo que pode ser reutilizado. Limpeza de uploads órfãos é futura. Os arquivos enviados são públicos para quem conhece a URL, inclusive antes de publicar a matéria; não use uploads para documentos confidenciais. Preserve o diretório em backups junto ao banco. Storage efêmero/serverless não é suportado pela implementação local.

## Consultas públicas, busca e SEO

Home, listagem, página individual, relacionados, busca e sitemap usam a mesma view temporal `public_news`. Não há cache estático de notícias que atrase o agendamento. `/noticias` oferece destaque, categorias, busca e paginação de 12 itens. Relacionadas usam a primeira categoria ativa e excluem a notícia atual; sem categoria ativa, usam outras notícias recentes.

Busca PostgreSQL cobre título, subtítulo e resumo com full-text em português e fallback literal de substring. Input limitado a 200 caracteres. Não interpreta a entrada como SQL. Não há Elasticsearch ou serviço externo. Corpo não participa da busca nesta fase.

SEO da notícia: título/descrição com fallbacks, canonical, Open Graph article, Twitter, NewsArticle e BreadcrumbList em JSON-LD. JSON-LD escapa `<` para impedir fechamento malicioso do script. Canonical aceita HTTP(S) absoluto, sem credenciais/fragmento; vazio usa SITE_URL e slug. Capa local recebe URL absoluta nos metadados.

`/sitemap.xml` é dinâmico e inclui somente notícias visíveis, além de home e listagem; limite inicial de 49 mil notícias para permanecer abaixo do limite de um sitemap. Particionamento será necessário se esse volume for atingido. `/admin`, inclusive login, recebe noindex/nofollow; robots bloqueia admin/API/busca. `/busca` também recebe noindex. Não houve envio de sitemap a mecanismos de busca.

## Rotas

Administrativas:

- `/admin`, `/admin/login` (existentes).
- `/admin/categorias`, `/admin/categorias/nova`, `/admin/categorias/[id]`.
- `/admin/autores`, `/admin/autores/novo`, `/admin/autores/[id]`.
- `/admin/noticias`, `/admin/noticias/nova`, `/admin/noticias/[id]`.

Públicas:

- `/` com notícias reais e layout/radio preservados.
- `/noticias`, `/noticias/[slug]`.
- `/busca?q=...`; categoria em `?category=slug` e paginação em `?page=N`.
- `/sitemap.xml`, `/robots.txt`, `/media/[filename]`.

O player continua no layout raiz; a navegação usa Next Link, preservando o elemento audio. Não foram alterados seu stream, controles ou reconexão. TV e demais áreas futuras permanecem estruturais.

## Auditoria

Eventos: categories/authors `.create`, `.update`, `.delete`; news `.create`, `.update`, `.status`, `.publish`, `.schedule`, `.archive`, `.draft`, `.featured`; `media.upload`, além dos eventos existentes de autenticação. Metadata registra somente mudanças de estado/datas/destaque necessárias, não conteúdo integral, senhas ou tokens. Exclusão editorial é arquivamento.

## Testes e banco isolado

```shell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E exige Microsoft Edge, porta 3100 livre e PostgreSQL **local** com CREATEDB. `TEST_DATABASE_URL` pode estar em `.env.test.local`; a conexão Neon da aplicação não é usada pelos testes. O runner recusa URL remota, cria banco de nome aleatório, aplica migrations e bootstrap duas vezes, executa o build via `next start` e remove o banco ao terminar. Uploads de teste ficam em `test-results/`, ignorado. O build deve ser feito antes do E2E.

Nesta máquina foi criado um cluster de testes separado em `.test-postgres/data`, escutando somente 127.0.0.1:55433 com SCRAM. A conexão está em `.env.test.local`, ignorado. Para reiniciar esse cluster no PowerShell:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .test-postgres/data -l .test-postgres/server.log -o '-h 127.0.0.1 -p 55433' start
```

Para parar, substitua os argumentos após `-D .test-postgres/data` por `stop -m fast`. Interrupção forçada dos testes pode deixar uma base `biosfera_test_*`; remova apenas após verificar que não está em uso.

Cobertura: hashes/sessões existentes; Markdown/XSS; formato/tamanho/bytes de imagens; criação e edição de categorias/autores, duplicidade e integridade; rascunhos ocultos; publicação e SEO; cronologia do agendamento; arquivamento; busca, categoria e paginação; EDITOR e revalidação de role; uploads e CSRF; conflito de edição; player persistente e reconexão; layout mobile.

## Fora desta fase

TV/HLS completo, programação/programas, podcasts, galerias, eventos, publicidade completa, automação de notícias/RSS, comentários/chat/enquetes, analytics/Meta, PWA, migração, deploy e DNS. Melhorias futuras: revisão/aprovação editorial se necessária, histórico de versões, redirecionamentos de slugs, limpeza de mídia órfã, storage externo e particionamento de sitemap. Nenhuma Fase 3 foi iniciada.

## Resultado desta entrega

- Lint, TypeScript e build de produção aprovados, sem avisos de tracing de uploads.
- 5 testes unitários e 9 testes E2E aprovados, incluindo os fluxos da Fase 1.
- Migration 002 aplicada e reaplicada com sucesso em bancos temporários locais; a 001 não foi modificada.
- Notícia mobile inspecionada visualmente; persistência do player e reconexão confirmadas pelos testes.
- Arquivos versionáveis verificados: nenhuma ocorrência das credenciais configuradas. Ambientes e uploads ignorados pelo Git.
- Após confirmação explícita do usuário de que o Neon configurado é de desenvolvimento, a migration 002 foi aplicada com sucesso. A verificação por leitura confirmou as duas migrations, as cinco tabelas editoriais, a view public_news e um OWNER ativo. A migration 001 e o OWNER existente foram preservados.

O banco de desenvolvimento está pronto para uso editorial. Inicie com `npm run dev` e acesse `/admin/noticias`. Nenhum dado editorial de teste foi inserido no Neon.

## Fase 2.1 — home e importação assistida

A home apresenta, nesta ordem: rádio/programação, duas notícias, câmera/chat e pedido musical. Em telas pequenas, os módulos ficam em uma coluna. Sem notícias públicas, aparece “ACOMPANHE A BIOSFERA”; com uma, ela ocupa a linha. Destaques públicos têm prioridade, seguidos pelas notícias mais recentes. Até seis notícias adicionais aparecem sem duplicação. Rascunhos, arquivos e agendamentos futuros permanecem ocultos.

`RadioProvider` mantém um único elemento de áudio no layout raiz. Os controles da home e da barra persistente compartilham reprodução, volume e reconexão. A programação tem uma estrutura para dados reais futuros, sem horários ou programas fictícios.

A câmera cria o iframe somente após clique. A configuração `LIVE_CAMERA_EMBED_URL` usa settings do banco, depois variável de ambiente e finalmente `https://playerv.tvr.ovh/video-premium/video36282/true/false/`. Existe botão para fechar e link para abrir o player externo; não foi instalada biblioteca HLS. A disponibilidade e as políticas de incorporação dependem do provedor. O chat é uma prévia desabilitada, identificada como recurso futuro; não recebe nem armazena mensagens.

### Banco e pedidos musicais

A migration `003_home_interactions.sql` adiciona `news.source_name` e `news.source_url`, atualiza `public_news` preservando suas colunas e filtro temporal, e cria `song_requests` e `request_limits`. As migrations 001 e 002 não foram modificadas.

O formulário de música grava nome, música/artista, mensagem opcional, data e status NEW. OWNER, ADMIN e EDITOR consultam a lista paginada em `/admin/pedidos-musicais`. A proteção básica combina validação, honeypot, tempo mínimo de dois segundos, origem da requisição, cookie HttpOnly/SameSite e limites compartilhados no banco: três pedidos por visitante e trinta tentativas globais a cada dez minutos. O teto global reduz abuso por renovação de cookies, mas pode limitar ouvintes legítimos em picos; dimensionar na próxima fase. Não há moderação, notificações ou garantia de execução da música.

### Importação editorial

Em `/admin/noticias/nova`, o importador autenticado consulta HTML público e extrai metadados Open Graph, JSON-LD e conteúdo semântico com `cheerio`. Preenche título, subtítulo/resumo, corpo Markdown e fonte quando disponíveis. Autor e data originais ficam como referência para revisão; o editor seleciona os cadastros internos e a publicação. A imagem externa fica apenas como referência: não é baixada nem incorporada automaticamente.

A importação prepara DRAFT no formulário, sem inserir notícia e sem publicar. Campos continuam editáveis; salvar exige a ação normal do editor. Sites dependentes de JavaScript, paywalls ou bloqueios podem não fornecer texto utilizável. A qualidade da extração varia e exige revisão humana. A fonte é persistida e exibida na notícia pública.

`lib/security/remote-page.mjs` aceita somente HTTP/HTTPS nas portas padrão, sem credenciais. `ipaddr.js` bloqueia IPs privados, reservados e mapeados; nomes locais são rejeitados. Todos os endereços DNS são verificados e a conexão fixa um endereço aprovado, preservando hostname/TLS. Cada um dos até três redirecionamentos repete a validação. O limite total é dez segundos e 2 MB; respostas não HTML e compressão são rejeitadas. Scripts e recursos da página não são executados ou carregados. A ação permite dez importações por conta a cada dez minutos e revalida autenticação/permissões. O primeiro salvamento registra a origem no audit log.

### Verificação e limites desta entrega

Foram executados lint, TypeScript, build de produção, dez testes unitários e treze testes E2E. Os E2E utilizam exclusivamente banco PostgreSQL local temporário e cobrem também as fases anteriores. A Fase 2.1 verifica os estados da home, responsividade, áudio único persistente, câmera sob demanda, pedidos e bloqueio de URL interna sem criar notícia. A extração bem-sucedida é coberta por teste unitário e uma consulta real somente de leitura a example.com. Desktop e mobile foram inspecionados visualmente.

Permanecem para fases posteriores: cadastro completo de programação/apresentadores, chat real, moderação de pedidos e infraestrutura própria de TV. Não houve deploy, DNS, migração do portal antigo nem início da Fase 3.

A migration 003 foi aplicada no Neon de desenvolvimento confirmado. A leitura posterior confirmou as três migrations, uma notícia existente e um OWNER ativo, com as mesmas contagens anteriores. Nenhum registro fictício foi inserido. A home local respondeu HTTP 200; como atualmente não há notícia elegível na view pública, exibiu o fallback institucional corretamente.

## Fase 3 — programação, apresentadores e chat

A migration `004_programming_chat.sql` foi aplicada ao Neon de desenvolvimento autorizado. As migrations 001–003 não foram modificadas. Não houve deploy, alteração de DNS ou acesso ao portal antigo. Os dados demonstrativos dos testes ficam exclusivamente em bases PostgreSQL locais temporárias, removidas pelo executor E2E.

### Modelo e cadastros

Sete tabelas novas: `presenters`, `programs`, `program_presenters`, `schedule_slots`, `schedule_exceptions`, `chat_visitors` e `chat_messages`. Apresentadores têm nome, slug único, biografia, foto, redes opcionais e estado ativo. Programas têm nome, slug único, descrições, imagem e estado ativo. A relação muitos-para-muitos usa chave composta e índice reverso. Os cadastros e faixas têm timestamps; alterações administrativas gravam auditoria na mesma transação.

Rotas administrativas: `/admin/apresentadores`, `/admin/apresentadores/novo`, `/admin/apresentadores/[id]`, `/admin/programas`, `/admin/programas/novo`, `/admin/programas/[id]`, `/admin/programacao` e `/admin/chat`. O segmento `novo` é resolvido pelo componente compartilhado de cadastro. É possível criar, editar, ativar, desativar e excluir. Exclusões de programas ainda usados em faixas são impedidas por FK, com mensagem orientando a remover vínculos ou desativar. URLs aceitam HTTPS sem credenciais ou imagens locais em `/media/`; HTML de descrições não é executado.

### Grade e cálculo central

`server/services/programming.ts` concentra consultas e gravações; `lib/programming/engine.mjs` calcula datas e intervalos. Cache React evita repetir consultas dentro de uma renderização. A grade usa dia da semana (0 domingo a 6 sábado), programa e intervalo semiaberto `[início,fim)`: horários consecutivos são válidos. Faixas ativas do mesmo dia não podem se sobrepor. As gravações passam por transação com advisory lock, e triggers validam conflitos no banco. O painel apresenta os sete dias, faixas ordenadas e formulários em seções expansíveis.

Faixas são limitadas a um dia: para atravessar meia-noite, cadastre duas; `24:00` é permitido somente no término. Isso torna os dias e os conflitos inequívocos. `schedule_exceptions` guarda data, faixa, programa, título, observação, cancelamento e estado. Exceções ativas têm prioridade apenas no intervalo indicado: a grade regular é recortada e pode retomar após a exceção. Cancelamentos deixam o intervalo sem programa, preservando a transmissão da rádio. Exceções entre si não podem conflitar na mesma data. Um programa inativo nunca aparece publicamente; uma exceção ativa cujo programa foi desativado mantém seu intervalo sem programa, evitando ressuscitar o programa substituído.

`PORTAL_TIMEZONE` em settings tem prioridade sobre a variável de ambiente; fallback `America/Sao_Paulo`. Um fuso inválido também usa esse fallback. `Intl.DateTimeFormat` determina data, hora e dia da semana explicitamente nesse fuso, sem depender do visitante ou servidor. A resolução devolve programa atual e até três próximos, buscando hoje e os sete dias seguintes. Ausência de horário mostra estado vazio, sem conteúdo fictício.

### Site público e home

`/programacao` mostra a semana corrente no fuso do portal, permite navegar pelos sete dias via `?dia=AAAA-MM-DD`, aplica exceções e destaca hoje e a faixa atual. `/programas` e `/apresentadores`, com páginas individuais por slug, mostram apenas ativos, imagens, descrições, redes e vínculos. Programas mostram horários regulares; a subnavegação conecta as três seções. Essas rotas e os slugs ativos integram o sitemap.

A home conserva rádio/programação, notícias, câmera/chat e pedido musical. `Broadcast` recebe dados iniciais do servidor e atualiza via `/api/programacao` a cada 30 segundos, apenas com a aba visível. Mostra Agora, próximos três e link para a grade; a rádio recebe apenas nome e apresentadores atuais. O `RadioProvider` e seu único elemento de áudio permanecem no layout persistente. Falha do banco na programação pública usa estado vazio e não interrompe rádio, câmera ou notícias.

### Chat e proteção

`/api/chat` oferece leitura e ações; a implementação PostgreSQL fica em `server/services/chat.ts`. Visitantes informam somente nome (até 40 caracteres). Um token aleatório de 256 bits é colocado em cookie HttpOnly, SameSite=Lax, Secure em produção, prefixo `__Host-` em produção e validade de sete dias; somente seu hash SHA-256 fica no banco. Bloqueio é por sessão, não por identidade civil: limpar cookies permite obter outra sessão, limitação inerente ao chat anônimo. Não há armazenamento de IP.

Mensagens têm até 500 caracteres, sanitização com allowlist vazia e renderização textual React. Conteúdo vazio ou apenas executável é rejeitado. Origem é validada em toda mutação; respostas e moderação exigem sessão administrativa válida. O envio relê bloqueio/expiração sob lock e usa contadores compartilhados de `request_limits`: uma mensagem por sessão/administrador a cada três segundos, teto global de 120 envios por minuto e 120 novas sessões por minuto. Limites globais mitigam renovação abusiva de cookies, mas devem ser dimensionados conforme audiência real. Bloqueio, envio e estado do chat usam transações para evitar gravações concorrentes inconsistentes.

O cliente faz polling sequencial a cada cinco segundos, pausando com aba oculta e cancelando agendamento ao desmontar. A home lê somente as últimas 30 mensagens visíveis, em ordem cronológica; o painel lê 60 por página com cursor `before`. Recarregar a janela recente também remove mensagens ocultadas/excluídas sem precisar reconstruir o banco para uma futura migração para SSE/WebSocket. Índices atendem leitura recente, status visível, visitante, expiração, dia e data da grade. Não foram adicionados Redis ou serviços externos.

Mensagens da equipe aparecem como BIOSFERA. O painel permite responder publicamente, ocultar, reexibir mensagens ocultas, excluir logicamente (`DELETED`), bloquear/desbloquear sessão e ativar/desativar o chat. Exclusão lógica não tem restauração na interface. `CHAT_ENABLED=false` impede entrada/envio e mostra “Chat temporariamente indisponível.”; o espaço da home é preservado. O padrão criado pela migration é `true`. A moderação registra ação e identificador em `audit_log`, sem copiar texto das mensagens.

### Permissões e configuração

OWNER, ADMIN e EDITOR administram todos os módulos desta fase, inclusive estado operacional do chat. A alteração de `CHAT_ENABLED` usa operação específica, sem conceder acesso genérico a settings. Permissões preexistentes de usuários, papéis e configurações críticas não foram ampliadas. O fuso fica em settings, sem novo painel genérico de configurações; `.env.example` documenta `PORTAL_TIMEZONE=America/Sao_Paulo` como fallback.

### Validação e próximos passos

Testes unitários cobrem fuso, virada de dia, limites de faixas, próximo programa, prioridade/recorte/cancelamento por data, inativos e sanitização. E2E cobre criação e relação de apresentadores/programas como EDITOR, cadastro e conflito da grade, exceção, páginas públicas, sessão de chat, limites, mensagens, resposta, ocultação, exclusão, bloqueio/desbloqueio, origem e desativação. A suíte anterior permanece como regressão de autenticação, editorial, pedidos, câmera e player persistente.

Fase 4 não iniciada. Permanecem fora desta entrega redesign final, publicidade completa, podcasts, galerias, eventos, migração do portal antigo, analytics, PWA, deploy/DNS e infraestrutura de streaming. Operacionalmente, preencher os cadastros reais e acompanhar o volume do chat para ajustar limites e eventual política de retenção; esta fase não remove mensagens ou sessões antigas automaticamente.

Resultado final em 27/09/2026: lint, TypeScript e build aprovados; 15 testes unitários e 15 E2E aprovados. Capturas de home, programação, admin/programacao, admin/programas, admin/apresentadores e admin/chat foram inspecionadas visualmente, além da grade mobile; ficam em `test-results/phase3-*.png` (artefatos locais ignorados pelo Git). O E2E também confirmou programa atual na API e na home usando uma exceção de teste para a data corrente. A consulta final somente de leitura no Neon confirmou as quatro migrations, um OWNER ativo, uma notícia existente, zero pedidos musicais, zero programas/apresentadores e os settings `CHAT_ENABLED=true` e `PORTAL_TIMEZONE=America/Sao_Paulo`. Cadastros e mensagens fictícios foram usados apenas nas bases locais isoladas.

## Fase 4 — equipe, operação administrativa e publicidade

### Migration e preservação

`005_admin_users_ads.sql` foi criada e aplicada no Neon de desenvolvimento autorizado. Acrescenta `users.deleted_at`, uma restrição que impede usuário excluído de ficar ativo e índice para gestão de usuários. Cria `ad_slots`, `ad_campaigns` e `ad_deliveries`, além de cinco posições iniciais. Não modifica migrations aplicadas nem apaga registros existentes. Não há dependências novas, ORM, serviços de publicidade externos ou alterações no portal antigo.

### Usuários, papéis e segurança

`/admin/usuarios` oferece busca por nome/e-mail, filtros de papel/status e paginação de 30 registros, com criação, último login e ações. `/admin/usuarios/novo` e `/admin/usuarios/[id]` permitem cadastro, edição, ativação/desativação, redefinição de senha e exclusão lógica. E-mail é normalizado para minúsculas e permanece único inclusive após exclusão lógica; para suspender temporariamente, use desativação. Usuários excluídos deixam a listagem, mas seus vínculos e auditoria são preservados.

OWNER gerencia todos os papéis. ADMIN cria e gerencia ADMIN/EDITOR, mas nunca cria, edita, rebaixa, desativa, exclui ou redefine a senha de OWNER. EDITOR não acessa gestão de usuários nem publicidade. A política desta fase passa a permitir que EDITOR também crie/edite categorias e autores, além das funções editoriais e operacionais das fases anteriores. As restrições existem nas rotas, formulários e server actions; esconder um item de menu não é a barreira de segurança.

`server/services/admin-users.ts` serializa mutações de usuários com advisory lock transacional e relê o ator, sua sessão e o alvo. Se a alteração remover o último OWNER ativo por rebaixamento, desativação ou exclusão, a transação é rejeitada. Com dois ou mais OWNER ativos, OWNER pode administrar outro OWNER. Desativação, exclusão, mudança de papel, reset e troca de senha revogam sessões do alvo; quando afetam o próprio operador, ele volta ao login. Autenticação existente é reutilizada, e o login relê o hash sob lock para impedir que uma senha antiga validada antes de um reset gere uma sessão depois dele.

Senhas têm de 12 a 256 caracteres e confirmação obrigatória. O hash existente scrypt com salt aleatório é reutilizado. Reset administrativo dispensa a senha antiga, mas exige privilégio sobre o alvo. `/admin/minha-conta` permite visualizar e-mail/papel, mudar apenas o nome e trocar senha informando a atual. Campos forjados de papel, e-mail ou estado nessa operação são rejeitados; o identificador do alvo é sempre o usuário autenticado. Há limite compartilhado de dez tentativas de criação/reset/troca de senha por operador em quinze minutos. Hashes, senhas e tokens não são enviados aos formulários nem gravados em audit_log.

Auditoria transacional registra `users.created`, `users.updated`, `users.activated`, `users.deactivated`, `users.role_changed`, `users.deleted`, `users.password_reset` e `users.password_changed`. Os metadados registram papel/estado, sem dados de autenticação.

### Dashboard e configurações

O dashboard apresenta notícias públicas, rascunhos, programas/apresentadores ativos, pedidos novos e mensagens visíveis nas últimas 24 horas. OWNER/ADMIN veem também campanhas em veiculação e usuários ativos. Cada indicador liga ao módulo correspondente. Vídeos permanece identificado como futuro.

`/admin/configuracoes` é exclusivo de OWNER e expõe somente a whitelist `SITE_NAME`, `RADIO_STREAM_URL`, `LIVE_CAMERA_EMBED_URL`, `PORTAL_TIMEZONE` e `CHAT_ENABLED`, com rótulos em português. Não há editor arbitrário de settings ou exposição de secrets. Rádio/câmera exigem HTTPS sem credenciais; fuso exige identificador IANA válido. Gravações são auditadas apenas com nomes das chaves. ADMIN/EDITOR mantêm a possibilidade operacional anterior de ativar/desativar chat no painel de moderação, sem acesso às demais configurações. Nenhuma variável secreta nova é necessária.

### Publicidade e upload

OWNER/ADMIN acessam `/admin/publicidade`, `/admin/publicidade/nova` e `/admin/publicidade/[id]`. O cadastro guarda nome interno, anunciante, posição, imagem principal, imagem mobile opcional, alt obrigatório, destino, início, término opcional, ativo e prioridade inteira de 0 a 1000. É possível pausar/reativar editando o estado. Listagem mostra posição, status efetivo, datas, prioridade, impressões, cliques e CTR, calculado como `cliques / impressões * 100`, com zero quando não há impressões. Não há cobrança, contratos ou gestão financeira.

Imagens usam `ImageUpload`, `/api/ads/upload` e a normalização/storage já existentes. Upload publicitário exige OWNER/ADMIN e origem válida. JPEG/PNG/WebP, até 5 MB e 20 megapixels, têm extensão, MIME e bytes conferidos, são decodificados e convertidos para WebP com nome UUID seguro. Executáveis e imagens animadas não são aceitos. O formulário só salva referências locais registradas em `media_assets`. `storeImage` continua sendo o ponto de substituição para storage externo futuro.

Destinos aceitam somente HTTP/HTTPS sem credenciais. Protocolos javascript, data, file e outros são rejeitados no cadastro e novamente no redirecionamento. Links usam `sponsored noopener noreferrer`. O banner utiliza `<picture>` com imagem mobile até 640 px; dimensões não são fixas e a proporção é preservada. Sem campanha válida ou com erro de imagem/banco, o componente desaparece sem caixa de placeholder.

### Posições, datas e rotação

Os códigos ficam centralizados em `lib/admin/policy.mjs` e têm registros persistidos em `ad_slots`: `HOME_BETWEEN_SECTIONS` (após notícias principais), `HOME_BOTTOM` (após pedido musical), `NEWS_TOP` (antes da matéria), `NEWS_BOTTOM` (após a matéria) e `FOOTER` (antes do rodapé público). O painel permite mudar nome/descrição e ativar/desativar cada posição. Os códigos representam pontos reais do layout; cadastrar novos tipos de posição depende de implementação futura, mas cadastrar campanhas nessas posições não exige código.

Veiculação exige posição e campanha ativas, `start_at <= now()` e `end_at > now()` ou sem término. Datas do formulário são interpretadas no fuso atual do portal e persistidas como timestamptz. Datas inválidas e término não posterior ao início são rejeitados. Horários inexistentes em transições de fuso são rejeitados por validação de ida e volta; horários ambíguos seguem a resolução do PostgreSQL. Mudar o fuso depois de salvar não altera os instantes de campanhas existentes.

Entre campanhas válidas, somente a maior prioridade participa. Empates são ordenados por UUID e alternam pelo minuto corrente (`floor(epoch / 60000) % quantidade`). A rotação é previsível, sem serviço externo e sem prometer distribuição uniforme de audiência. Cada posição reconsulta a cada 60 segundos em aba visível; pausa administrativa pode levar até esse intervalo para sumir de uma página já aberta. O fim agendado também arma um timer local para retirar o banner. Cliques e impressões revalidam atividade/datas no servidor, mesmo antes da atualização visual.

### Impressões, cliques e limites

`/api/ads/serve?slot=...` retorna apenas dados públicos e cria um recibo UUID aleatório em `ad_deliveries`, válido por uma hora. Consultar o backend não incrementa métricas. O componente registra uma impressão via POST `/api/ads/impression` somente após a imagem carregar e pelo menos 50% do banner permanecer no viewport por um segundo contínuo com aba visível. A origem do POST é validada. Cada atualização do banner tem novo recibo; cada recibo incrementa cada métrica no máximo uma vez.

O link aponta para `/api/ads/click/[id]?receipt=...`: valida campanha, posição, datas e recibo; registra clique em transação e redireciona ao destino validado com resposta sem cache. Repetir o mesmo recibo não duplica contagem. HEAD não é contado. Locks no PostgreSQL e incrementos atômicos protegem concorrência. Contadores agregados ficam em `ad_campaigns`; recibos não guardam IP, usuário, fingerprint ou token de autenticação. Entregas válidas removem em lotes de até 100 os recibos expirados há mais de um dia. Sem novas entregas válidas, essa limpeza oportunista fica adiada.

As métricas são aproximadas: bloqueadores, falha de rede e JavaScript desativado podem subcontar; não há sistema antifraude comercial. Um clique rápido pode ocorrer antes de completar o segundo de visibilidade, portanto cliques não exigem impressão prévia e CTR pode superar 100% em amostras pequenas. Nenhum popup, overlay publicitário ou inserção por parágrafo foi criado; player, câmera, chat e ordem principal das seções permanecem preservados.

### Validação e limites da fase

Testes cobrem matriz de privilégio, política de senha, URLs, prioridade/rotação, datas e CTR; os E2E exercitam criação de ADMIN/EDITOR por OWNER, duplicidade de e-mail, proteção do último OWNER, tentativa forjada de reset de OWNER por ADMIN, revogação de sessões, login desativado, reset, Minha Conta, configurações, upload, permissão administrativa de publicidade, exibição real, impressão por visibilidade, clique sem duplicação, campanhas futuras/expiradas/inativas, fallback e banner editorial responsivo. O cenário antigo de categorias/autores foi atualizado para a política explícita de EDITOR desta fase.

Capturas locais de usuários, novo usuário, Minha Conta, configurações, publicidade, home e notícia ficam em `test-results/phase4-*.png`. Dados de teste são usados somente em PostgreSQL local temporário. Nenhum usuário, banner ou anunciante fictício é criado no Neon.

Fase 5 não iniciada. Permanecem fora do escopo redesign final, migração do portal antigo, podcasts, galerias, eventos, analytics externos, PWA, deploy/DNS, cobrança, gateway, faturas e CRM comercial. Para começar a operação, OWNER pode cadastrar a equipe e OWNER/ADMIN podem enviar banners e agendar campanhas pelo painel.

Resultado final da Fase 4: lint, TypeScript e build aprovados, 20 testes unitários aprovados e suíte completa com 18 E2E aprovados. As capturas das sete telas solicitadas foram inspecionadas visualmente, incluindo notícia com publicidade no celular. A leitura final no Neon confirmou cinco migrations registradas, um usuário/OWNER ativo, uma notícia existente, zero programas/faixas/mensagens/pedidos, cinco posições publicitárias e nenhuma campanha de teste. Nenhum deploy, alteração de DNS, alteração de produção ou início de Fase 5 foi realizado.
