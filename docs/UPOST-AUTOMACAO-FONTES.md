# Medios Asociados — automação de notícias

## Estado da entrega

**Atualização:** a migração 010 foi aplicada com autorização, as fontes foram ativadas, notícias reais com fotos foram publicadas e o agendamento local está instalado. O estado operacional atual e suas evidências estão em [UPOST-NOTICIAS-FONTES-REAIS.md](./UPOST-NOTICIAS-FONTES-REAIS.md). As notas abaixo registram etapas anteriores da implantação.

Código implementado no módulo existente, com acesso explícito **Fuentes automáticas** em `/admin/fuentes-automaticas` e link em `/admin/red`. A migração `010_source_automation.sql` foi preparada **e não foi aplicada**. Após autorização explícita do usuário, Infobae, Presidencia del Uruguay e Xataka foram cadastradas pelo painel no Neon, todas inativas. Não foram publicadas notícias nem instalados agendamentos. O cadastro e a rádio existentes continuam funcionando sem a migração.

O banco precisa da migração para configuração e execução da automação, mas o cadastro básico dos veículos utiliza a tabela existente da 009. O painel mostra **La automatización requiere activar la base de datos.** e mantém a sincronização desabilitada até a estrutura existir. Não há execução automática de migrações no aplicativo, cron ou scripts de sincronização.

## Fontes verificadas em 05/11/2026

| Fonte externa | Método confirmado | Dados encontrados | Categoria inicial |
| --- | --- | --- | --- |
| [Infobae](https://www.infobae.com/) | [RSS oficial](https://www.infobae.com/arc/outboundfeeds/rss/) — 100 entradas na consulta | Título, identificador, data, resumo, link e imagem no feed; subtítulo, corpo público e metadados na reportagem | Mundo |
| [Presidencia de Uruguay](https://www.gub.uy/presidencia/comunicacion/noticias) | Listagem HTML oficial — 10 notícias na consulta; sem RSS confirmado | Título e URL na listagem; resumo, imagem, corpo e data pública DD/MM/AAAA na reportagem | Uruguay |
| [Xataka](https://www.xataka.com/) | [RSS oficial](https://www.xataka.com/feedburner.xml) — 26 entradas na consulta | Título, identificador, data, link e texto de apresentação no feed; resumo, imagem e corpo nos metadados/HTML da reportagem | Tecnología |

O RSS geral do Infobae inclui, entre outras seções, América, México, Colombia, Perú, Economía, Política e Tecno. Foi usado o endpoint efetivamente testado, com filtro inicial por Uruguay, Mercosur e países da região. O Xataka inclui Robotica e IA, Componentes, Energía, Ingeniería e outras editorias; o filtro inicial prioriza tecnologia, IA, informática, ciência e inovação. Os filtros são editáveis e não prometem classificação semântica por IA.

A Presidencia apresentou falhas transitórias de conexão, seguidas de sucesso no transporte seguro. Há uma única nova tentativa limitada para falhas transitórias. A data visível da Presidencia é convertida para o início do dia em America/Montevideo, sem inventar uma hora original de publicação.

`node scripts/verify-news-sources.mjs` repete as verificações públicas **sem banco** e salva o relatório em `test-results/news-sources-verification.json`. O script também guarda amostras temporárias de HTML no diretório ignorado pelo Git. A verificação de uma amostra não garante disponibilidade futura de todas as reportagens.

## Ativação administrativa, depois da migração manual

1. Revisar a migração 010, fazer backup do Neon exclusivo do UPOST e aplicá-la manualmente pelo procedimento de migrações do projeto. Não apontar esse procedimento para outro projeto. A 010 só acrescenta três tabelas e índices; não remove nem reescreve recursos, campanhas ou notícias existentes.
2. Abrir `/admin/red` e usar **Configurar Infobae, Presidencia y Xataka**. Cada fonte é testada novamente antes do cadastro. Falhas não criam um cadastro fictício. Registros existentes são preservados; novos registros são `Fuente externa`, nunca parceiros formais.
3. As fontes novas começam **inativas**, preservando a homepage, com modo **revisión**, automação **desativada**, intervalo de 30 minutos e limite de 3 notícias como configuração inicial após a 010. O administrador pode ativar a fonte, mudar para publicação automática e definir frequência, quantidade, categoria e conteúdo. Logotipo é opcional e utiliza o upload já existente; não foram inventados logotipos.
4. Salvar a fonte e usar **Sincronizar ahora** para uma consulta. O comando manual funciona mesmo com o agendamento da fonte desativado, desde que o recurso esteja ativo e tenha configuração salva.
5. Para consultas contínuas, marcar **Consultar automáticamente** e configurar um dos agendadores abaixo. Abrir o painel não inicia nem substitui o agendamento.
6. Em **Revisar noticias importadas**, os borradores usam o editor existente: título, resumo, fotografia, categoria e publicação continuam editáveis no fluxo normal de Noticias.

## Agendamento independente do painel

Não foi encontrado manifesto que identifique um provedor de hospedagem ou um cron já configurado no repositório. O ambiente de desenvolvimento é Windows. Não foram criadas tarefas do sistema nem alterada infraestrutura externa.

Há duas entradas para o mesmo serviço:

- **Node em servidor/Windows:** executar `node scripts/sync-sources.mjs` a cada 5 minutos, com diretório de trabalho `C:\tech\upost-uy` e Node 24. No Agendador de Tarefas do Windows, configurar o executável Node, argumento `scripts/sync-sources.mjs`, iniciar nessa pasta e repetir a cada 5 minutos, inclusive sem sessão interativa. O script carrega o ambiente existente e verifica a identidade do Neon UPOST antes de sincronizar. A tarefa não foi instalada nesta entrega.
- **Hospedagem com cron HTTP:** definir `CRON_SECRET` aleatório com pelo menos 32 caracteres exclusivamente no servidor e chamar `GET` ou `POST /api/cron/sources` a cada 5 minutos com `Authorization: Bearer <CRON_SECRET>`. Não passar o segredo na URL. Configurar o agendador oferecido pelo provedor e confirmar que o plano permite execução Node de até 300 segundos. O código exporta esse limite; ele não amplia os limites contratuais da hospedagem. Se o plano não permitir, usar o worker Node por fora do request HTTP.

O disparo pode ocorrer a cada 5 minutos; cada fonte só é consultada quando `next_sync_at` vence, conforme seu intervalo de 15–1440 minutos. Padrão: 30. O serviço considera até três fontes vencidas por disparo, ordenadas pela próxima consulta; as demais permanecem vencidas para o próximo disparo. Cada fonte permite 1–10 novas notícias (padrão 3). Há orçamento global de 220 segundos, timeouts de rede e uma tentativa adicional limitada. Uma execução com falhas é reagendada pelo intervalo normal, sem loop agressivo.

## Integridade, qualidade e armazenamento

- Cron e sincronização manual usam a mesma trava PostgreSQL de sessão. Uma segunda execução retorna `busy`, sem importar. A trava cai se a conexão/processo morrer. Uma consulta interrompida é identificada como tal na execução seguinte.
- Duplicidade por identificador da fonte e URL canônica normalizada (sem fragmentos e parâmetros comuns de rastreamento). Canonical e redirecionamentos da reportagem precisam continuar no domínio da fonte. O controle também consulta notícias já existentes no portal.
- A notícia, categorias e identificador de origem são gravados **na mesma transação** do serviço `saveNews`, evitando uma janela de falha entre criação e registro da origem. A URL usa a trava de duplicidade do importador existente. Colisões não sobrescrevem notícias editadas.
- Reaproveita `extractArticle`, `importArticleImages`, `importEditorialImage`, sanitização e validações editoriais. Autenticação e permissões administrativas preservadas. Downloads mantêm limites, DNS fixado, bloqueio de redes internas, TLS e validação de redirecionamentos.
- Não há tentativa de contornar login, paywall ou bloqueio. Resumos podem usar informações do feed público quando a reportagem estiver indisponível. O modo completo não transforma conteúdo marcado como pago em publicação integral.
- Resumo/link é o padrão das três fontes externas. Texto completo disponível é uma escolha editorial, sem comprovantes, campos de licença ou etapas adicionais. Autor original, fonte, data e link são preservados quando encontrados; o autor cadastrado para a automação é o nome da fonte, sem atribuir reportagem externa à Redacción UPOST.
- Título, resumo e data válidos são necessários; datas futuras ou notícias com mais de sete dias não entram na carga automática. Extração completa insuficiente gera erro; alertas de mídia no modo completo encaminham a notícia para revisão mesmo se a fonte estiver em publicação automática.
- Fotografias passam pelo armazenamento existente e só referências locais registradas entram na notícia. Imagem indisponível vira card sem imagem, nunca hotlink quebrado. Em produção, configurar o R2 conforme o serviço existente; falhas de storage não publicam referências inválidas.
- A página `/medios-asociados` e a faixa inferior da homepage distinguem os parceiros registrados das fontes externas. Não há notícia confinada a essa faixa: publicadas usam `news`, `news_categories` e o fluxo normal das editorias. Os logotipos podem ser enviados pelo cadastro existente; na ausência deles, usa-se apenas o nome.

## Monitoramento e testes

O painel mostra data da última consulta, última notícia elegível, totais importados e duplicados, estado e mensagem objetiva. `source_sync_runs` registra cada execução e o serviço produz logs `source.sync` sem credenciais.

Testes unitários exercitam RSS/Atom, HTML sem RSS, URLs e canonical, temas, data da Presidencia, retries limitados, modo automático, revisão, falta de imagem, fonte indisponível, repetição do agendamento, trava concorrente, encaminhamento de conteúdo incompleto e atomicidade do registro de origem. Dependências de banco/rede/storage são isoladas nesses testes; não são testes de gravação no Neon.

Testes de navegador verificam a página pública em 1440, 768 e 390 px, ausência de scroll horizontal, preservação do banner/rádio, redirecionamento do admin sem login e rejeição do cron sem segredo. As capturas do diretório no ambiente atual mostram o estado sem fontes cadastradas. A configuração, importação persistida e aprovação completa pelo painel precisam ser verificadas no banco após a aplicação manual da migração 010; não foram simuladas como concluídas em produção.

Arquivos principais: `database/migrations/010_source_automation.sql`, `server/services/source-automation.ts`, `lib/editorial/source-sync.mjs`, `server/services/editorial.ts`, `server/repositories/editorial.ts`, `lib/editorial/import-article.mjs`, `app/admin/resource-actions.ts`, `app/admin/(protected)/red/page.tsx`, `components/admin/resource-form.tsx`, `components/admin/source-controls.tsx`, `app/api/cron/sources/route.ts`, `scripts/sync-sources.mjs`, `scripts/verify-news-sources.mjs`, `app/(public)/medios-asociados/page.tsx`, `components/editorial/associated-media.tsx`, `components/editorial/associated-media.module.css`, `app/(public)/page.tsx`, `.env.example` e os testes relacionados.

Sem migração aplicada, push, deploy ou alterações na Biosfera.

Resultado final: TypeScript e build aprovados; 62 testes unitários e 8 testes de navegador aprovados (incluindo regressão das fotos/fade do carrossel em 1440, 1024, 768 e 390 px). ESLint sem erros, com dois avisos preexistentes em `admin-session-guard.tsx` e `public-video-player.tsx`.
