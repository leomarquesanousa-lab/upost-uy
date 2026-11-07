# Retenção de notícias - ativação posterior

A migracao 011 foi aplicada com backup completo validado, sem alterar noticias existentes nem executar limpeza real. A view public_news foi preservada e a limpeza definitiva permanece desativada.

1. Revisar e autorizar `database/migrations/011_news_lifecycle.sql`, após backup. Ela adiciona política, metadados de ciclo de vida, tombstones, fila de mídia e relatórios, e adiciona `public_news_managed`, preservando a view `public_news` e suas colunas. Requer a 010. Não exclui dados nem adiciona vencimentos a notícias existentes.
2. Novas importações automáticas exigem a 011; se pendente, o painel informa e o sincronizador não importa sem limites. Notícias manuais e importações antigas continuam preservadas. Publicação usa a view comum para home, busca, categorias, artigo e sitemap; vencidos retornam o 404 existente.
3. Configurar limites em Fuentes automáticas. Padrões: cinco/fonte/dia, vinte globais/dia de Montevideo, mínimo sessenta minutos, 48h de publicação a partir da primeira publicação no portal, sete dias de recuperação, quinhentas ativas. A contagem ativa inclui registros antigos não arquivados e borradores, sem colocá-los na expiração.
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
- Edições humanas protegem notícias automáticas. Permanência impede expiração e limpeza. Restaurar gera borrador protegido e permanente, sem publicar. Notícias manuais e lixeira manual não entram na exclusão automática.
- Tombstones não retêm corpo/fotos e sobrevivem à exclusão da notícia e da fonte. A tabela de identificadores existente também conserva sua referência com `news_id=NULL`.
- Mídia exige registro, evidência de upload importado no R2, chave UUID WebP e ausência de referências em notícias/corpos, autores, apresentadores/programas, vídeos, campanhas, recursos e configurações. Escritores compartilham locks de mídia, impedindo remoção concorrente de um arquivo em uso.
- Legados migrados do disco sem evidência R2 na auditoria são preservados por cautela. Não há limpeza de imagens externas, arquivos locais originais ou imagens públicas da marca.
- Objetos são processados separadamente, após commit das notícias; erro no R2 mantém a fila com reintento. Objetos já ausentes podem ser reconciliados sem duplicação. Arquivos órfãos importados e comprovadamente próprios só entram na fila após o período de segurança e nova verificação de referências.
- Lotes limitados (até 500 vencimentos, 100 exclusões e 100 objetos) e orçamento de tempo. Filas maiores continuam na próxima execução. Relatórios e auditoria conservam contagens e falhas.
