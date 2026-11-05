# Fuentes automáticas no painel

**Estado atual:** a 010 foi aplicada com autorização e a sincronização está funcionando. Consulte [UPOST-NOTICIAS-FONTES-REAIS.md](./UPOST-NOTICIAS-FONTES-REAIS.md). Os avisos de migração pendente descritos abaixo pertencem ao diagnóstico anterior e não aparecem mais no estado atual do banco.

## Acesso

Menu administrativo **Fuentes automáticas** → `/admin/fuentes-automaticas` (OWNER e ADMIN). Também há acesso destacado em `/admin/red`, que preserva os formulários de parceiros, rádios e fontes.

## Causa da invisibilidade

O acesso anterior chamava-se “Red y fuentes”; os três veículos só apareceriam depois de cadastrados. Não havia registros de fontes no Neon e o botão de configuração era desabilitado enquanto a migração 010 estivesse pendente.

Agora Infobae, Presidencia del Uruguay e Xataka aparecem como opções reais de cadastro mesmo sem a migração. Cada cartão mostra site, categoria, frequência, automação, última consulta, encontradas, importadas, duplicadas e ações. Logotipo utiliza o campo existente, quando preenchido; não foram inventadas marcas.

## Dependência do banco

A migração 010 é necessária para configuração persistida da automação, histórico, contadores, identificação de itens e sincronização agendada/manual. **Ela não é necessária para registrar os veículos**, pois a migração 009 já fornece `portal_resources`.

O aviso é explícito: **La automatización requiere activar la base de datos.** Não existe ação que execute migrações pelo painel.

**Registrar las tres fuentes** ou **Registrar fuente** valida os endpoints públicos e salva no cadastro existente. Registros existentes são preservados. Novos registros começam **inativos**, sem alterar a homepage, rádio, banners ou publicar notícias. Depois do cadastro, **Editar configuración** funciona para os dados básicos, inclusive site, categoria, feed e logotipo; os controles de automação aparecem após a aplicação manual da 010.

**Sincronizar ahora** fica visível e desabilitado enquanto a estrutura da automação não existir. Não há promessa de sincronização executada nesse estado. O agendamento também requer um job externo e `CRON_SECRET` para a opção HTTP; não foi instalado automaticamente.

## Autenticação e renderização

O login continua criando a sessão e redirecionando para `/admin`. O painel inicial e seu layout não consultam as tabelas da 010. As consultas de diagnóstico responderam, sem bloqueios de SQL ativos; a falha específica do login relatada depende da reprodução com entrada manual.

Foram medidos tempos temporários de autenticação, validação de sessão e integrações. Esses logs foram removidos. A validação da mesma sessão é compartilhada dentro de cada renderização, e o pool agora limita conexão (3 s), espera por lock (3 s), execução SQL no servidor (10 s) e espera do cliente (12 s), incluindo conexões renovadas após HMR. A área protegida tem estados de carregamento e erro recuperável. Nenhuma senha foi alterada, nenhum administrador foi recriado e nenhuma migração foi aplicada.

Testes unitários cobrem cadastro sem 010, preservação de registros, permissões e rejeição de fontes indisponíveis; dados fictícios de teste não entram no Neon.

## Verificação real concluída

Após entrada manual do usuário numa sessão nova, o cookie de sessão foi criado, `/admin` exibiu o dashboard e “Ingresando…” desapareceu em cerca de 4,3 segundos. O menu abriu `/admin/fuentes-automaticas` com três cartões e o aviso da migração.

O teste identificou que o processo de desenvolvimento ainda executava a versão antiga da ação de cadastro (mensagem exigindo 010), apesar dos arquivos atualizados. O sistema operacional negou encerrar esse processo; a recarga automática da configuração do próprio Next reiniciou o servidor e carregou os módulos atuais. O comentário usado para provocar essa recarga foi removido.

Com autorização explícita do usuário, o botão “Registrar las tres fuentes” cadastrou **Infobae, Presidencia del Uruguay e Xataka** no Neon exclusivo do UPOST, todas com `active=false`. As três foram confirmadas por consulta ao banco. Nenhuma notícia foi publicada e a 010 segue pendente. `CRON_SECRET` não está configurado; nenhum agendamento foi instalado.

Foram abertos os três formulários “Editar configuración” no navegador e verificados seus campos. “Sincronizar ahora” permanece corretamente desabilitado enquanto a 010 não for aplicada. Capturas revisadas em 1440, 768 e 390 px, sem scroll horizontal. Evidências locais em `test-results/interactive-login-status.json`, `test-results/automatic-sources-browser-result.json` e `test-results/automatic-sources-*.png` (sem senhas ou tokens).
