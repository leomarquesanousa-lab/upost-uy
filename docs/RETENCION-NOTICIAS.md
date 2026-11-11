# Retenção de notícias — 15 dias, ativação posterior

**Estado atual:** política ativa em produção: migração 012 aplicada, **360 horas**, recuperação de **7 dias**, limpeza definitiva habilitada após dry-run aprovado e cron horário confirmado. Zero inscrições retroativas e zero exclusões na ativação. Ver [RETENCAO-ATIVADA-PRODUCAO.md](RETENCAO-ATIVADA-PRODUCAO.md). As observações históricas abaixo sobre pendência ou cron não verificado descrevem a preparação anterior à ativação autorizada.

A política definitiva é de **15 dias completos (360 horas)** desde a data de publicação, para novas notícias automáticas e manuais. A migração 012 foi aplicada na publicação autorizada, sem inscrição retroativa nem exclusões durante a ativação. A migração histórica 011 permanece imutável por checksum; seus defaults antigos foram substituídos pela 012, sem alterar notícias existentes.

1. Revisar e autorizar `database/migrations/011_news_lifecycle.sql`, após backup. Ela adiciona política, metadados de ciclo de vida, tombstones, fila de mídia e relatórios, e adiciona `public_news_managed`, preservando a view `public_news` e suas colunas. Requer a 010. Não exclui dados nem adiciona vencimentos a notícias existentes.
2. Revisar `database/migrations/012_fifteen_day_retention.sql` após backup, antes de ativar o código em produção. Ela define `prospective_from`, fixa `publication_hours=360`, desativa a limpeza definitiva e adiciona `retention_managed=false` às linhas existentes. Não inscreve nem recalcula prazos antigos. Apenas novas publicações a partir do marco podem ser inscritas; edição de notícia já publicada e notícia retrodatada não inscrevem legados. Sem a 012, a rotina de manutenção informa pendência e não executa limpeza.
3. Configurar limites em Fuentes automáticas. Padrões preservados: cinco/fonte/dia, vinte globais/dia de Montevideo, mínimo sessenta minutos, sete dias de recuperação e quinhentas automáticas ativas. A publicação é fixa em **15 dias**, independente desses limites. A data agendada vale como publicação; editar não prolonga o prazo. A view comum atende home, busca, categorias, artigo e sitemap e oculta os elegíveis ao vencer. A rotina encaminha à lixeira e conta o período completo de recuperação a partir desse encaminhamento, inclusive se o cron estiver atrasado.
4. Executar primeiro a simulação, somente após autorização de leitura do ambiente: `node scripts/sync-sources.mjs --retention-only --dry-run`. O padrão do comando sem `--dry-run` executa expiração e sincronização; a limpeza definitiva exige ainda a opção habilitada no painel. **Não executar o comando normal como teste de instalação.**
5. Ativar posteriormente um cron horário no KVM, no diretório do projeto, usando `node scripts/sync-sources.mjs`. O script reutiliza as configurações do ambiente e a guarda de identidade do banco. A opção `--retention-only` executa só a manutenção, mesmo com fontes desativadas. Nenhum agendamento foi instalado nesta tarefa.

Alternativa HTTP, protegida por `Authorization: Bearer <CRON_SECRET>` (mínimo 32 caracteres):

- `/api/cron/sources?task=all`: expiração, limpeza habilitada e sincronização.
- `?task=sync`: somente sincronização, respeitando cotas e intervalo.
- `?task=expire`: somente expiração, sem eliminar definitivamente.
- `?task=cleanup`: somente limpeza de itens já retirados, se habilitada.
- `?task=all&dryRun=1`: simulação somente leitura; nunca sincroniza.

Não colocar o segredo em URL, código ou logs. Não foi verificada nem alterada a configuração do KVM. Um scheduler local Windows a cada trinta minutos pode continuar chamando o script, mas o importador respeita o mínimo global de sessenta minutos.

## Segurança

- Limites novamente verificados na transação de criação, sob trava de cota. Sincronização e manutenção usam travas independentes e itens são revalidados sob lock.
- Exclusão manual é lixeira, não apagamento imediato. Editor pode retirar/restaurar; somente ADMIN/OWNER podem eliminar definitivamente ou retirar proteção editorial. Todas as ações validam sessão/origem no servidor e usam auditoria.
- Edições humanas protegem notícias automáticas. Permanência, proteção editorial, destaque e escolha manual da notícia principal impedem expiração e limpeza. Restaurar gera borrador protegido, sem publicar. A data original não é reiniciada ao retirar permanência. Novas notícias manuais inscritas usam a mesma rotina das automáticas; lixeira manual continua fora da exclusão automática.
- Tombstones não retêm corpo/fotos e sobrevivem à exclusão da notícia e da fonte. A tabela de identificadores existente também conserva sua referência com `news_id=NULL`.
- Mídia exige registro, evidência de upload manual ou importado no R2, chave UUID WebP e ausência de referências em notícias/corpos, autores, apresentadores/programas, vídeos, campanhas, recursos e configurações. Escritores compartilham locks de mídia, impedindo remoção concorrente de um arquivo em uso. A varredura de órfãos e a fila antiga também respeitam o marco prospectivo; não há limpeza retroativa de arquivos.
- Legados migrados do disco sem evidência R2 na auditoria são preservados por cautela. Não há limpeza de imagens externas, arquivos locais originais ou imagens públicas da marca.
- Objetos são processados separadamente, após commit das notícias; erro no R2 mantém a fila com reintento. Objetos já ausentes podem ser reconciliados sem duplicação. Arquivos órfãos importados e comprovadamente próprios só entram na fila após o período de segurança e nova verificação de referências.
- Lotes limitados (até 500 vencimentos, 100 exclusões e 100 objetos) e orçamento de tempo. Filas maiores continuam na próxima execução. Relatórios e auditoria conservam contagens e falhas.

## Validação desta alteração

Executar somente `node --test tests/news-lifecycle.test.mjs`, cobrindo 15 dias completos, publicação manual/automática, datas de publicação/agendamento, recuperação, restauração, proteções, ausência de inscrição retroativa, dry-run somente leitura, arquivos compartilhados e falhas R2. Não é necessário repetir a suíte completa do portal.

Resultado desta entrega: **17 testes de retenção aprovados**, TypeScript (`tsc --noEmit`) e lint dos arquivos afetados aprovados. A suíte de 93 testes não foi repetida. A busca nos arquivos ativos de código, documentação e configurações não encontrou referências ao prazo anterior.

O atalho `node scripts/preview-fifteen-day-retention.mjs` chama o mesmo `sync-sources.mjs --retention-only --dry-run`, preservando as guardas de identidade do banco. A migração 012 deve ser revisada e aplicada em etapa separada; executar o dry-run novamente antes de habilitar qualquer limpeza definitiva. Nenhuma configuração do banco real foi alterada nesta entrega.

Dry-run executado: `ready:false`, `dryRun:true`, `synchronization:null`, mensagem de migração 012 pendente. Os zeros retornados são da guarda de ativação, não uma contagem de elegíveis sob a nova política ainda não ativada. Nenhuma notícia foi expirada, excluída ou sincronizada; nenhum objeto R2 foi removido.
