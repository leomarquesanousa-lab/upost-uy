# Relatorio final de seguranca - Biosfera TV

Atualizacao: 2026-11-01. Estado: preparado e validado localmente; NAO publicado.

## Projeto e implantacao identificados

Repositorio: C:\tech\biosfera-site, origin leomarquesanousa-lab/biosfera-site.
Dominio: radiotvweb.com.br.
Implantacao observada anteriormente por SSH somente leitura:
01a18a28-0e01-718b-98d9-4c70616ba583, executando Next 16.3.6.
Caminho remoto: /home/u604106388/domains/radiotvweb.com.br/hbuilds/versions/01a18a28-0e01-718b-98d9-4c70616ba583/nodejs.
As cinco versoes informadas no alerta coincidem com o lockfile local original.
O scanner completo da Hostinger nao foi fornecido e nao havia lockfile nos caminhos
consultados da release remota; nao se reconciliaram literalmente os 24 alertas.
O npm audit inicial contou 21 pacotes sinalizados, agregando cadeias transitivas.
Isso nao representa uma declaracao de seguranca dos demais sites.

## Dependencias corrigidas

- next e eslint-config-next: 16.3.6 -> 16.4.3.
- undici transitiva do Cheerio: 7.30.0 -> 7.30.1.
- zod transitiva das ferramentas de lint: 4.6.5 -> 4.6.7.
- sanitize-html: 2.17.7 -> 2.18.1; remove deepmerge 4.3.1 do grafo e corrige
  os alertas adicionais de sanitizacao encontrados no audit.
- brace-expansion: patches compativeis 1.1.21 e 5.0.12 no grafo final.

Sem audit fix --force, overrides globais de Minimatch, troca de versao principal
do Next ou novas dependencias diretas de Undici/Zod.

Audit final repetido: producao (--omit=dev) = ZERO vulnerabilidades.
Audit completo = 16 moderadas, ZERO altas/criticas/baixas.
Os 16 registros propagam o alerta GHSA-g3hv-75wg-m249 do Minimatch na cadeia de
ESLint/TypeScript-ESLint. O patch publicado e 11.0.1, sem patch disponivel nas
linhas 3.x/10.x instaladas. Nao se forcou uma API principal diferente nos consumidores.
Os alertas continuam relevantes para ferramentas de desenvolvimento/build; nao foram
suprimidos. Acompanhar atualizacoes compativeis dos consumidores.

## Revisao dos dois erros de lint

1. AdminSessionGuard: a funcao de useCallback agora tem o nome checkIdleSession e
   usa esse nome na chamada recursiva. Mantidos prazo, dependencias, storage,
   eventos e logout. A pesquisa de referencias confirma que esse componente NAO
   esta montado na interface atual. Nao foi ativado nem se adicionou timeout novo.
2. CookieConsent: preservado exatamente o codigo de hidratacao de document.cookie
   no effect. Uma excecao eslint-disable-next-line, restrita a chamada setVisible,
   documenta a sincronizacao com estado exclusivo do navegador depois do SSR.
   Nao houve reescrita funcional nem desativacao global da regra. Testes reais de
   navegador confirmam o comportamento com e sem cookie e ao reabrir preferencias.

Lint final: ZERO erros e dois avisos anteriores, de navegacao window.location
(admin-session-guard) e uso de img (public-video-player). Nenhum aviso novo.

## E2E seguro executado

Criado um cluster PostgreSQL 18 NOVO e exclusivo em subpasta GUID ignorada de
.test-postgres, porta temporaria 49206, escuta apenas em 127.0.0.1.
Nenhum servico PostgreSQL existente foi iniciado, parado ou reconfigurado.
O runner scripts/e2e.mjs foi executado a partir de uma copia SOMENTE EM MEMORIA,
ignorando os carregamentos iniciais de .env e .env.test.local e recebendo URL
explicita do cluster descartavel. O arquivo do runner e os .env foram preservados.
R2 foi desabilitado no ambiente efemero. Nenhuma credencial de producao foi usada.
O runner criou bases biosfera_test_* aleatorias, aplicou as oito migracoes e
bootstrap DUAS vezes, executou os testes e removeu as bases ao terminar.
Verificacao final: ZERO bases biosfera_test_* restantes. O cluster exclusivo foi
encerrado e sua pasta removida. Nenhum banco existente ou dado de cliente foi alterado.

E2E final: 7 passaram (foundation.spec.ts + security-regression.spec.ts):
- idempotencia de migracoes/bootstrap;
- login valido/invalido, sessao protegida, expiracao, inativacao e logout;
- rate limit de login e rejeicao de origem externa/CSRF;
- radio: reproducao real no navegador com WAV sintetico, pausa, continuidade
  do elemento/audio durante navegacao e layout mobile;
- radio: limite de reconexoes e nova tentativa manual;
- cookie existente: hidratacao, preferencias e preservacao das escolhas;
- cookie ausente: aviso e opcoes facultativas desmarcadas.

Corrigida apenas uma expectativa E2E antiga: schema_migrations esperava cinco,
mas o projeto ja possui oito migracoes. Nenhum SQL/migracao foi modificado.
Um teste exploratorio de timeout ocioso foi removido porque pressupunha montagem
de AdminSessionGuard; a interface nao o utiliza. O comportamento nao foi alterado
para satisfazer essa suposicao. A expiracao real de sessao passou no E2E existente.

## Demais validacoes

- npm run build: aprovado, Next 16.4.3/Webpack.
- npm run typecheck: aprovado, repetido apos os ajustes finais dos testes.
- npm run lint: aprovado, 0 erros / 2 avisos.
- npm test: 28 passaram, 0 falharam.
- git diff --check: aprovado.
- Build com URL de banco temporariamente apontada para loopback indisponivel,
  sem alterar os .env; nao executou migracoes de producao.

## Escopo funcional preservado e limites da confirmacao

Diff confirmado sem alteracoes em app/, server/, lib/, database/, next.config.ts,
playwright.config.ts ou scripts de inicializacao. Nenhuma rota declarada, configuracao
de imagens, endpoint de upload, autenticacao backend, schema, integracao ou URL da
radio foi alterado. React/React DOM 19.2.8 e sharp 0.35.5 foram preservados.
A tabela de rotas produzida pelo build mantem as rotas previamente observadas.
Os testes unitarios validaram imagens reais/Sharp, sanitizacao/SSRF, uploads,
storage/R2 e falhas usando fixtures e respostas simuladas.

Nao se afirma equivalencia absoluta de todo comportamento interno do Next apos
upgrade. A autenticacao e radio selecionadas passaram no navegador local; o stream
externo REAL, proxy/HTTPS Hostinger, cookies no dominio publico e uploads com storage
real ainda exigem smoke test autorizado depois da publicacao. A suite E2E completa,
em especial uploads com R2, nao foi executada contra servicos reais.

## Arquivos alterados nesta preparacao completa

- package.json e package-lock.json: dependencias.
- components/admin/admin-session-guard.tsx: nome da funcao recursiva.
- components/privacy/cookie-consent.tsx: comentarios e excecao local justificada.
- tests/e2e/foundation.spec.ts: expectativa das oito migracoes existentes.
- tests/e2e/security-regression.spec.ts: duas regressoes de consentimento.
- docs/DEPENDENCY_SECURITY_AUDIT.md: este relatorio.

Nenhuma mudanca de UV_THREADPOOL_SIZE ou de variaveis hPanel.

## Publicacao futura e verificacao funcional

Somente apos autorizacao especifica de commit/push/deploy:
1. Revisar e publicar exclusivamente este conjunto Biosfera. Registrar o ID da release
   atual e preservar a release/artefato anterior e configuracoes existentes de forma
   segura, fora do Git. Nao exportar credenciais para este relatorio.
2. Usar npm ci com o lockfile revisado e build limpo. Nao executar migracoes de banco:
   esta correcao nao possui mudanca de schema.
3. Em dominio e www, confirmar Next 16.4.3 e uma release consistente nos processos.
4. Testar portal, noticia, imagens/_next/image, APIs publicas e rejeicoes de acesso.
5. Com conta de teste autorizada: login/logout, cookie Secure/HttpOnly/SameSite,
   navegacao autenticada e controle de permissoes, sem editar conteudo de clientes.
6. Radio desktop/mobile: play, pause, navegacao, stream HTTPS real e recuperacao
   apos falha; confirmar ausencia de erro CORS/mixed content.
7. Uploads reais somente com arquivo/conta/area de teste exclusivos autorizados,
   verificando leitura e descarte; nao substituir imagens/videos existentes.
8. Conferir scanner Hostinger, erros 5xx, latencia e NPROC. Nenhum teste acima de
   producao ou carga foi executado nesta tarefa.

## Rollback (preparado; NAO executado)

Base Git anterior a esta preparacao: b0666ee95cd94545e0203d1f3ca51bd7383c9557.
Release remota anterior identificada: 01a18a28-0e01-718b-98d9-4c70616ba583.

- Antes de publicar, identificar a ultima release funcional e preferir uma ja corrigida.
  Rollback de producao apenas pelo mecanismo gerenciado existente da Hostinger e
  mediante autorizacao; nao matar processos nem sobrescrever arquivos da release.
- Se aparecer regressao bloqueante, registrar o erro, retornar a release selecionada,
  preservar todas as variaveis hPanel, banco e storage e validar dominio/www,
  login/logout, portal, imagens e radio. Nao reverter banco: nao houve migracoes.
- Retornar especificamente a release antiga Next 16.3.6 reintroduz os alertas de
  seguranca. Deve ser uma medida excepcional com exposicao controlada e correcao
  posterior; nao e o estado seguro desejado.
- Reversao local do codigo deve usar diff/hunks por arquivo, preservando trabalho
  posterior. Se apenas um ajuste de lint apresentar problema, reverter SOMENTE esse
  ajuste mantendo Next 16.4.3 e o lockfile corrigido. Nao usar reset --hard nem
  git clean para desfazer esta tarefa. O hash-base e referencia, nao autorizacao
  para restaurar o repositorio inteiro.

Nenhum commit, push, deploy, alteracao em producao ou outro site foi realizado.

## Referencias dos advisories consultados

- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/nodejs/undici/releases/tag/v7.30.1
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/advisories/GHSA-g3hv-75wg-m249
