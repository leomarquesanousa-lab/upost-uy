# Radio Mix Artigas — integração confirmada

## Fonte e áudio

- Site oficial: https://www.radiomixartigas.com/
- Configuração pública: https://www.radiomixartigas.com/config.js
- Player oficial: https://www.radiomixartigas.com/app.js?v=20261017v
- Provedor identificado no site: Bachi Streaming.
- Fluxo direto: https://radio.bachistreaming.com/radio-mix-artigas
- Resposta verificada: HTTPS 200, `Content-Type: audio/aac`, `icy-name: Radio Mix Artigas`,
  `icy-br: 128`, 44.100 Hz, dois canais. Não é uma página HTML nem iframe.

O navegador reproduziu o áudio real, com avanço de `currentTime`, tanto no player
oficial quanto no player do UPOST. Não foi usado áudio simulado nos testes positivos.

## Migração autorizada e backup

A tabela `portal_resources` ainda não existia. Após autorização explícita do usuário,
a migração `009_portal_resources.sql` foi revisada: cria a tabela, seu índice público,
o índice de busca em espanhol e inclui posições publicitárias com `ON CONFLICT DO NOTHING`.
Não contém DROP, DELETE, TRUNCATE nem ALTER.

Os checksums das oito migrações anteriores foram conferidos. Foi produzido um backup
lógico completo em formato custom do PostgreSQL, sem senhas nos argumentos do processo,
com TLS verificado e verificação do arquivo por `pg_restore --list`:

`storage/backups/upost-before-009-2026-11-05T18-25-02-372Z.dump` (64.519 bytes).

O backup contém dados privados do portal; `storage/backups` foi excluído do Git.
O arquivo vazio da tentativa de backup interrompida foi removido. Somente o arquivo
válido verificado foi preservado, além do certificado público usado na conexão.

A 009 foi aplicada uma vez, em transação, com trava de migração, timeout de locks,
registro de checksum em `schema_migrations` e comparação dos dados existentes:

- Sete posições publicitárias preservadas, inclusive seus IDs e estados.
- Uma campanha existente preservada integralmente.
- Cinco notícias preservadas.

Scripts manuais, nunca chamados pela aplicação:

- `node scripts/apply-009-upost-radio.mjs`: conferência, sem executar nova migração.
- `node scripts/apply-009-upost-radio.mjs --commit`: backup e aplicação controlada,
  somente se a 009 ainda não estiver registrada. Identidade do Neon UPOST obrigatória.
- `node scripts/register-mix-artigas.mjs --commit`: verifica novamente configuração,
  áudio e identificação da rádio e cadastra/atualiza sem duplicar.

## Cadastro e player

Nome: **Radio Mix Artigas**. Localidade: **Artigas, Uruguay**. Tipo: **Radio en vivo**.
Cadastro ativo em `portal_resources`, com site, streaming HTTPS e logotipo oficial
copiado pelo armazenamento de mídia já existente. Edição no painel existente
`/admin/red`, grupo “Radios en vivo”: nome, descrição/localidade, site, logo, streaming,
ordem e ativo/inativo. Nenhum painel ou campo de banco novo foi criado.

O `RadioProvider` existente foi conectado ao layout público compartilhado, com um único
elemento `<audio>`. Os cards reutilizam esse player; não criam áudios concorrentes.
A barra identifica a rádio e a conexão, com Play/Pause e volume. Não faz pedido de
áudio antes do clique em Play. Pausar interrompe a conexão; retomar conecta à emissão
ao vivo, sem reproduzir um buffer antigo. Falhas têm tentativas limitadas e mensagem
de erro com botão para tentar novamente.

Navegação interna por links Next.js mantém o mesmo áudio e a mesma conexão. Recarregar
completamente a página, fechar a aba ou sair do layout público interrompe a sessão;
após recarregar é necessário clicar em Play novamente. Não se promete continuidade
nesses casos. O controle de volume foi verificado em Chromium desktop e viewport móvel;
o volume em dispositivos iOS pode depender dos controles nativos do sistema.

## Testes

`node node_modules/@playwright/test/cli.js test --config=playwright.radio.config.ts`

- Desktop 1440 px e celular 390 px: sem autoplay, áudio real AAC, Play/Pause,
  volume mínimo/máximo, presença em “Radios en vivo”, ausência de overflow.
- Homepage → notícia → rádios: mesmo elemento de áudio, tempo avançando e apenas
  uma requisição de streaming durante a sessão de reprodução.
- Falha de rede simulada apenas no teste negativo: tentativas limitadas, mensagem
  compreensível, reprodução interrompida e possibilidade de retentar.
- Capturas: `test-results/radio/`. Relatórios de migração/cadastro:
  `test-results/radio-migration-result.json` e `radio-registration-result.json`.

TypeScript, ESLint e build executados; os testes existentes do portal também foram
executados. Revisão visual em desktop e celular. Sem alteração na Biosfera, push ou deploy.

## Arquivos da integração

- `app/layout.tsx`, `app/(public)/layout.tsx`.
- `server/services/portal-resources.ts`.
- `components/editorial/resource-list.tsx`.
- `components/admin/resource-form.tsx`.
- `components/radio/radio-player.tsx`, `radio-player.module.css`, `radio-station-card.tsx`.
- `scripts/apply-009-upost-radio.mjs`, `scripts/register-mix-artigas.mjs`.
- `playwright.radio.config.ts`, `tests/radio/live-radio.spec.ts`.
- `.gitignore` e este documento.
