# Noticias de nuestras fuentes — entrega e evidências

## Homepage

As caixas com nomes dos veículos foram substituídas por **Noticias de nuestras fuentes**, antes do rodapé. A seção busca no banco uma notícia publicada com fotografia por fonte e exibe foto 16:10, nome da origem, título de até três linhas, resumo de até três linhas, data e links para a matéria no portal e a fonte original. Três colunas no desktop, duas no tablet e uma no celular. Imagens com recorte `cover` e raio de 12 px.

O atalho redundante “Medios asociados” no bloco inferior da homepage foi removido. O diretório de fontes, o cadastro administrativo e o link institucional do rodapé foram preservados, assim como cabeçalho, faixa financeira, banners e rádio.

As notícias usam as tabelas editoriais normais e aparecem também em `/noticias?category=mundo`, `/noticias?category=uruguay` e `/noticias?category=tecnologia`.

## Primeiras três matérias revisadas e publicadas

1. **Infobae — Escándalo en Paraguay EN VIVO: el Congreso no le aceptó la renuncia a Santiago Peña y avanza hacia el juicio político.**
   - [Fonte original](https://www.infobae.com/america/america-latina/2026/11/05/crisis-politica-en-paraguay-en-vivo-el-partido-colorado-le-pidio-la-renuncia-al-presidente-santiago-pena/).
   - URL no portal: `/noticias/crisis-en-paraguay-en-vivo-el-congreso-debate-la-renuncia-de-santiago-pena-en-medio-del-escandalo-de-ueno-bank-4d8c23d3`.
   - Fotografia real da sessão do Congresso, copiada da reportagem: `/media/681b67f8-e00c-412c-a244-4acbacf07646.webp` (1200×630).
2. **Presidencia del Uruguay — Incremento de empleo femenino contribuyó a reducir pobreza en Uruguay.**
   - [Fonte original](https://www.gub.uy/presidencia/comunicacion/noticias/trabajo-mujeres-uruguay-mercosur-datos-mtss-castillo).
   - URL no portal: `/noticias/incremento-de-empleo-femenino-contribuyo-a-reducir-pobreza-en-uruguay-9bb3590e`.
   - Fotografia da trabalhadora publicada na reportagem: `/media/f8c9ad26-222b-4c1c-8246-f1a57c3e5e42.webp` (945×556).
3. **Xataka — La IA ya está amenazando los cartuchos de Nintendo.**
   - [Fonte original](https://www.xataka.com/componentes/ia-esta-amenazando-cartuchos-nintendo).
   - URL no portal: `/noticias/la-ia-ya-esta-amenazando-los-cartuchos-de-nintendo-9246866b`.
   - Fotografia do Nintendo Switch da reportagem: `/media/f8f08dad-597e-4f3d-bd3b-1ab27f5c73de.webp` (840×560).

As três foram importadas inicialmente como borradores, tiveram título, data, canonical, resumo e fotografia conferidos com a fonte pública e foram aprovadas pelo serviço editorial `saveNews`, com validação de versão/mídia e auditoria. Os textos publicados são resumos com link e identificação da autoria/origem; não foram copiados corpos integrais. Outros borradores dos testes permanecem na fila.

As manchetes de cobertura ao vivo podem mudar na fonte. O título do Infobae foi atualizado durante a revisão, preservando o slug e o canonical já cadastrados. Novas publicações automáticas podem substituir esses destaques na homepage; o relatório JSON registra o estado mais recente.

## Estado real e contadores

O relatório [UPOST-FONTES-RESULTADO.json](./UPOST-FONTES-RESULTADO.json) contém o momento da verificação, contadores por fonte, publicadas/borradores, últimas execuções, URLs e fotografias dos destaques atuais, checksum da migração e dados de verificação do backup. Nenhum dado de teste fictício foi inserido no Neon.

Após o ciclo automático de 14h30 no horário do computador (America/Los_Angeles), existem **três notícias importadas por fonte**, sendo **duas publicadas e uma em revisão** por veículo: nove importadas, seis publicadas, três borradores. O ciclo automático importou uma notícia de cada fonte, ignorou cinco duplicatas e terminou sem erros, com código 0. A seção selecionou os destaques novamente a partir do banco sem abrir o painel. Todas as URLs importadas e suas imagens estão na chave `articles` do relatório JSON.

Foram comprovadas sincronizações reais pelo botão **Sincronizar ahora** para as três fontes. A repetição da Presidencia ignorou uma URL já importada e recuperou outra notícia, sem duplicar o registro. Um teste adicional no Neon ocupou a trava de concorrência e comprovou que o segundo worker retorna `busy`; após a liberação, a repetição antes do próximo horário não importou conteúdo extra.

## Migração e backup

Somente `010_source_automation.sql` foi aplicada, uma vez, após autorização explícita. Ela contém sete comandos aditivos: três tabelas e quatro índices. Os nove checksums anteriores foram conferidos e os dados preexistentes foram comparados dentro da transação, sem divergência. A 010 não deve ser alterada nem reaplicada.

- Backup completo: `storage/backups/upost-before-010-2026-11-05T21-14-45-587Z.dump`.
- Tamanho: 75.294 bytes.
- SHA-256: `bb6a7d9d56359971c11655de796a0dc7f3a64509e0925ce618b457c304fcd88f`.
- Arquivo listado e lido integralmente pelo `pg_restore`, sem restaurar nem alterar outra base.
- Checksum da 010: `1bfee03a365be46aacefef05cc4cacd2d75abd8e51d734f8a1401eda7fe21432`.

## Automação e qualidade

Depois do primeiro teste em revisão e da aprovação das três matérias, as fontes foram habilitadas em **publicação automática de resumos**, com limite de **uma notícia por fonte por execução**, categorias Mundo/Uruguay/Tecnología e frequência de 30 minutos. O administrador pode mudar essas opções em `/admin/fuentes-automaticas` ou `/admin/red`.

- Descoberta por RSS oficial em Infobae/Xataka e listagem HTML oficial da Presidencia; extração reaproveita o importador existente.
- Identificadores da fonte e canonical normalizado impedem duplicatas. Notícia e vínculo de origem são gravados na mesma transação.
- Uma notícia sem fotografia armazenada não é aceita pela automação; o worker tenta outra publicação recente, dentro dos limites, e registra a falha com URL na auditoria.
- Metadados cortados não viram resumos incompletos: o importador busca frases completas no conteúdo público. Se a qualidade ainda exigir conferência, a notícia vai para revisão.
- Autenticação administrativa, sanitização, limites de download, proteção SSRF e acesso público das fontes preservados. Nenhum paywall ou bloqueio foi contornado.
- Fotografias reais passam pelo armazenamento existente. Neste ambiente usam WebP local em `storage/uploads`, servidos por `/media/…`; não são hotlinks nem imagens genéricas.

A trava foi corrigida para uma transação dedicada, compatível com o pool transacional do Neon, em vez de depender de estado de sessão entre consultas. [Referência técnica do Neon](https://neon.com/docs/connect/connection-pooling).

## Agendamento instalado e limite de hospedagem

O ambiente configurado é `SITE_URL=http://localhost:3000`. Existe um agendamento persistente no Windows chamado **UPOST.uy - Fuentes automaticas**, com repetição de 30 minutos, alinhado às meias horas. Ele executa `scripts/scheduled-sources.mjs` em segundo plano, sem depender de abrir navegador ou painel. O wrapper chama o worker protegido pela identidade do banco UPOST e grava logs diários em `storage/logs` (ignorados pelo Git), sem segredos nos argumentos.

A execução automática real já foi observada, com término de código 0, importação de notícias e detecção de duplicata. O horário seguinte é mostrado pelo Agendador de Tarefas. Execuções simultâneas são ignoradas e as datas `next_sync_at` respeitam a frequência configurada.

**Limite real:** esse job exige este computador ligado e o usuário Windows conectado. Não equivale a um serviço 24×7 na hospedagem. Não foi feito deploy nem configurado cron em provedor externo.

**Passo restante na hospedagem definitiva:** cadastrar o job de 30 minutos do provedor apontando para o script `node scripts/sync-sources.mjs`, ou para `POST https://<domínio-do-portal>/api/cron/sources` com `Authorization: Bearer <CRON_SECRET>` e o segredo configurado somente no servidor. A execução HTTP precisa suportar até 300 segundos; caso contrário, usar o worker Node do provedor. Não colocar o segredo na URL. O storage de produção deve usar a configuração R2 já prevista no projeto, sem credenciais no cliente.

## Validação e arquivos

TypeScript, ESLint e build executados. A suite unitária cobre 66 testes, incluindo RSS/HTML, canonical, SSRF, concorrência, fotos ausentes, tentativa de outra notícia, resumos completos, revisão e publicação. Os testes de navegador usam as notícias reais e verificam quatro larguras (1440, 1024, 768, 390), fotos decodificadas, proporção, limites de linhas, links, páginas individuais e categorias. Também há regressão dos banners, rádio e faixa financeira; as expectativas dos testes foram atualizadas para os indicadores realmente disponíveis e para o acervo crescente, sem mudar a faixa financeira.

Resultado: **66 testes unitários e 25 testes de navegador aprovados**, TypeScript e build aprovados. ESLint sem erros, com dois avisos preexistentes em componentes não relacionados.

Arquivos principais: `components/editorial/source-news.tsx`, `components/editorial/source-news.module.css`, `app/(public)/page.tsx`, `app/(public)/home.module.css`, `server/repositories/editorial.ts`, `server/services/source-automation.ts`, `lib/editorial/source-sync.mjs`, `components/admin/automatic-sources.tsx`, `app/admin/(protected)/red/page.tsx`, `scripts/apply-010-source-automation.mjs`, `scripts/approve-reviewed-source-news.mjs`, `scripts/enable-source-auto-publication.mjs`, `scripts/scheduled-sources.mjs`, `scripts/install-source-schedule.ps1` e testes relacionados.

Sem alterações na Biosfera, push ou deploy.
