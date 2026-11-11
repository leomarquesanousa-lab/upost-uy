# UPOST — preparação da ativação de retenção de 15 dias

## Estado efetivo

**Ainda não ativa em produção.** O KVM executa `2d6c56a4acc1973658652149d70fcb0633b40e8c`. A migração 012 não está publicada nem aplicada no Neon. A configuração real permanece em **48 horas**, recuperação de **7 dias** e limpeza definitiva **desativada**.

A implementação local usa 360 horas (15 dias completos) e foi validada em uma restauração real do backup. Aplicar apenas a migração, mantendo a rotina antiga no servidor, seria inseguro: a rotina antiga não usa a marca prospectiva `retention_managed`. A ativação depende de publicação coordenada autorizada, não apenas de trocar um número no banco.

## Backup e validação da 012

Backup novo, completo, obtido por leitura do Neon:

`storage/backups/upost-before-012-2026-11-11T04-41-19-491Z.dump`

- Tamanho: **337.329 bytes**.
- Manifesto SHA-256: mesmo caminho com sufixo `.json`.
- Arquivo lido integralmente por `pg_restore` e efetivamente restaurado em uma instância PostgreSQL local isolada, vinculada somente a `127.0.0.1`.
- Migração 012 executada **somente nessa cópia local**. A instância de teste foi parada ao finalizar; o backup e o relatório permanecem preservados.
- Comparados contagens e fingerprints de notícias, vínculos, autores, mídia, fontes, identificadores e ciclo de vida antes/depois. Nenhum conteúdo, prazo legado ou limite de importação foi modificado.
- Resultado local: `publication_hours=360`, recuperação preservada, `cleanup_enabled=false`, zero notícias antigas inscritas.
- Dry-run da rotina real sobre a cópia migrada: `ready=true`, `expired=0`, `removed=0`, `images=0`, `errors=0`.
- Relatório: mesmo caminho do backup com sufixo `.review.json`.
- **17 testes direcionados de retenção aprovados**; lint do novo verificador aprovado. A suíte completa do portal não foi repetida.

O comando `node scripts/review-012-retention.mjs` reproduz o backup/restauração/revisão. Não possui modo de aplicação em produção. É possível reutilizar um backup verificado com `--backup=storage/backups/ARQUIVO.dump`.

## Abrangência depois da ativação

- Novas publicações manuais de jornalistas e administradores e publicações automáticas/RSS compartilham o mesmo ciclo de vida e prazo de **15 dias completos desde a data de publicação**. Programadas usam a data prevista de publicação efetiva.
- O marco `prospective_from` impede inscrição retroativa de publicações anteriores. As linhas antigas recebem `retention_managed=false`; não há backfill de expiração nem exclusão de conteúdo antigo.
- Notícias permanentes, protegidas, destacadas ou escolhidas como principal ficam fora da expiração e da limpeza, conforme os controles existentes.
- Ao completar 15 dias, a view pública oculta as elegíveis independentemente do horário do cron. A rotina encaminha à lixeira na execução seguinte.
- O prazo completo de recuperação é contado do encaminhamento efetivo à lixeira: sete dias na configuração verificada. Restaurar retorna a um borrador protegido, sem republicação automática.
- Só depois da recuperação, com limpeza definitiva explicitamente habilitada, a mesma rotina remove registros elegíveis, conserva tombstones/auditoria e processa a fila R2.
- Arquivos exigem registro, prova de propriedade no R2, correspondência de chave/tamanho/tipo e ausência de referências em outras notícias e demais entidades. Arquivos compartilhados ou sem comprovação permanecem. Falhas ficam na fila para nova tentativa. Órfãos e filas anteriores ao marco prospectivo não são limpos retroativamente.

## KVM e agendamento verificados

- Host confirmado: `179.199.132.121`, hostname `srv2116455`.
- Aplicação: `/opt/upost/current`, usuário `upost`, serviço `upost-web.service`, ambiente `/etc/upost/app.env` (permissão `640 root:upost`).
- Release real: `/opt/upost/releases/2d6c56a4acc1973658652149d70fcb0633b40e8c-20261108T225243Z`.
- Node: `v24.22.2`.
- **Já existe agendamento horário**, em `/etc/cron.d/upost-sources`: `0 * * * *`, executado como `upost`, usando o script `sync-sources.mjs` no diretório do UPOST e `--env-file=/etc/upost/app.env`.
- `cron.service` está ativo. As variáveis essenciais de banco, R2 e segredo estão preenchidas no processo e no carregador de ambiente. Nenhum valor secreto foi registrado nos relatórios.
- Esse cron já chama a manutenção junto com a sincronização. **Não é necessário criar outro cron ou timer**. Quando a nova release estiver em `/opt/upost/current`, o agendamento existente chamará automaticamente a rotina nova, mantendo limites e frequência de importação.
- Dry-run no KVM usando o mesmo carregador de ambiente: `expired=2`, `removed=0`, `images=12`, `errors=0`, `synchronization=null`. São candidatos da política antiga; nenhuma expiração, exclusão, chamada de escrita ao R2 ou sincronização foi executada durante essa verificação.
- `ia-marquesano-web.service` permaneceu ativo com PID `42427` antes e depois. Nenhum serviço foi reiniciado, parado ou reconfigurado nesta tarefa.

## Ativação coordenada — somente após autorização de publicação

1. Revisar e autorizar a release com o código novo e a migração 012. Confirmar backup recente verificado; repetir o backup se necessário antes da janela de ativação.
2. Durante a janela autorizada, suspender somente o job do UPOST e impedir novas publicações no intervalo de transição. Não executar a rotina antiga contra o esquema novo. Não tocar em serviço, porta, arquivos ou cron da IA Marquesano.
3. Aplicar a 012 em transação, validando o checksum da 011, os dados preservados, os limites de importação e o marco prospectivo. Registrar nome/checksum no histórico de migrações.
4. Publicar o código correspondente e validar apenas `upost-web.service`. Confirmar 360 horas, a mesma recuperação e nenhuma inscrição retroativa. Executar `sync-sources.mjs --retention-only --dry-run` na nova release.
5. Após conferir o dry-run e a autorização para ativação, habilitar `cleanup_enabled` pelo controle administrativo existente, com auditoria. A migração deixa esse valor falso de propósito; ela não pode iniciar exclusões sozinha.
6. Retomar o cron horário existente. Verificar a primeira execução e os relatórios `news_cleanup_runs`. Depois disso, expiração e limpeza funcionam automaticamente, sem intervenção manual recorrente.

Se houver falha de publicação, manter o job do UPOST suspenso até alinhar código e esquema; usar o backup verificado conforme o plano de recuperação. Não fazer downgrade de código isoladamente sobre o esquema novo com o cron antigo ativo.

## Alterações desta tarefa

- Adicionado `scripts/review-012-retention.mjs`, estritamente de revisão/backup/restauração isolada.
- Adicionado este plano de ativação e atualizado o documento de retenção com o estado verificado.
- A migração 012 existente foi validada sem alteração de seu SQL.

Não houve deploy, migração no Neon, ativação de limpeza, exclusão de registros/objetos reais, alteração de limites, modificação do cron ou intervenção na IA Marquesano.
