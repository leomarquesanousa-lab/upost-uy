# UPOST — retenção de 15 dias ativa em produção

Ativação autorizada concluída. Código publicado: **`913ae1770228fbaf12c211c6d4d694c3f5f93b6b`**, enviado a `origin/main` e compilado no KVM. Nenhuma alteração adicional de design foi feita nesta etapa; a release inclui as atualizações do portal aprovadas anteriormente.

## Estado confirmado

| Item | Resultado |
| --- | --- |
| Migração | `012_fifteen_day_retention.sql` aplicada e registrada no histórico |
| Checksum SHA-256 | `de5a051349b90b1175dbd76c738ee9e52c8705217942e5bad59c4f5cf9c0c4ee` |
| Prazo | **360 horas — 15 dias completos** |
| Recuperação na lixeira | **7 dias** |
| Limpeza definitiva | **Habilitada**, após dry-run aprovado |
| Aplicação | Prospectiva; novas publicações de jornalistas, administradores e importações/RSS, independentemente da origem |
| Notícias anteriores inscritas retroativamente | **0** |
| Notícias realmente excluídas na ativação | **0** |
| Objetos R2 removidos na ativação | **0** |
| Limites de importação | Preservados: 20/dia globais, intervalo mínimo de 60 minutos, 500 automáticas ativas; configurações por fonte inalteradas |
| HTTPS UPOST | **HTTP 200** |
| IA Marquesano | Ativa; PID **42427**, sem reinício |

Marco prospectivo registrado no banco: `2026-11-11T05:02:51.050Z` — **10/11/2026, 21:02, America/Los_Angeles**. As notícias anteriores não foram inscritas na nova expiração. Permanentes, protegidas, destacadas e a principal manual continuam preservadas. Não foram criados registros fictícios em produção.

## Publicação coordenada executada

1. Confirmados o backup anteriormente restaurado, Git, host `srv2116455`, serviço, caminhos e release anterior.
2. Criado backup atualizado e efetivamente restaurado em PostgreSQL local isolado; a 012 foi validada nessa cópia, preservando os dados e os limites. Não foram repetidos os 17 testes já aprovados.
3. Commit enviado a `origin/main`. Nova release preparada separadamente, sem alterar dependências. O build passou usando o ambiente do UPOST e PostgreSQL em modo somente leitura.
4. Pausado exclusivamente `/etc/cron.d/upost-sources`; preservada cópia exata do arquivo.
5. Parado somente `upost-web.service`. A 012 foi aplicada em transação, sob locks, com fingerprints dos dados antes/depois, verificação do backup e zero adesões retroativas. A limpeza permaneceu falsa nesta etapa.
6. Trocado atomicamente `/opt/upost/current` para a release nova. Iniciado somente o UPOST e verificados acesso local e HTTPS.
7. Executado o dry-run da rotina nova: `ready=true`, `expired=0`, `removed=0`, `images=0`, `errors=0`. Somente depois foi habilitado `cleanup_enabled`, com auditoria.
8. Restaurado o cron original, comparado byte a byte com o backup. Confirmados configuração efetiva no Neon, auditoria sem exclusões e serviços ativos.

## Funcionamento automático

O cron existente em `/etc/cron.d/upost-sources` permanece **horário (`0 * * * *`)**, como usuário `upost`, usando o carregador nativo `--env-file=/etc/upost/app.env` e o script existente em `/opt/upost/current`. `cron.service` está ativo. Não foi criado outro agendamento nem reiniciado o daemon global de cron.

A rotina nova será chamada automaticamente pelo mesmo job. Não foi forçada uma execução de limpeza real durante a validação: o teste de execução foi somente dry-run. O próximo ciclo horário segue a agenda existente.

Ao completar 15 dias, a view pública oculta as notícias elegíveis. O cron encaminha à lixeira, garantindo sete dias completos de recuperação a partir do encaminhamento efetivo. A restauração produz borrador protegido. Depois da recuperação, a rotina só elimina os registros elegíveis e processa os arquivos exclusivos comprovados no R2, após verificar referências, chave, tamanho e tipo. Arquivos compartilhados, administrativos ou sem comprovação são preservados; falhas mantêm a fila de tentativa. Notícias e arquivos legados não são limpos retroativamente.

A varredura de arquivos sem vínculo abrange somente uploads importados. Uploads manuais e administrativos sem vínculo ficam preservados. Arquivos exclusivos de notícias manuais seguem pela fila da própria notícia, após a recuperação e as verificações de referência. A limpeza ficou desabilitada durante esta correção e foi reabilitada somente após novo build e dry-run zerado.

## Backup e referências de rollback

- Backup validado: `storage/backups/upost-before-012-2026-11-11T04-56-35-256Z.dump`, **337.329 bytes**, com manifesto e relatório de restauração (`.json` e `.review.json`).
- Cópia protegida no KVM: `/opt/upost/backups/upost-before-012-2026-11-11T04-56-35-256Z.dump` e relatório de revisão.
- Release ativa: `/opt/upost/releases/913ae1770228fbaf12c211c6d4d694c3f5f93b6b-retention15`.
- Referência anterior: `/opt/upost/rollback-retention15`, apontando para a release `2d6c56a4acc1973658652149d70fcb0633b40e8c-20261108T225243Z`.
- Cron original preservado em `/opt/upost/backups/upost-sources.before-15days`.

Um eventual rollback deve coordenar código, esquema e job; não retornar isoladamente à rotina antiga sobre o esquema novo com o cron ativo. Nenhuma restauração de banco em produção foi necessária ou executada.

Nginx, configurações do Neon/R2, diretório `/var/lib/upost/uploads` e `ia-marquesano-web.service` não foram modificados. Apenas o UPOST foi reiniciado.

Evidência local final: `artifacts/retention/production-activation.json` — configuração e contagem de auditoria consultadas em transação somente leitura. Logs de build e backups permanecem fora do Git.
