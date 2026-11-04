# Storage editorial: investigação e operação

## Conclusão e limites da evidência

- O usuário confirmou um deploy na Hostinger em 12/10/2026 e ausência de variáveis R2 naquele ambiente. O commit local daquele dia, `436f295`, alterou apenas `package.json` e `package-lock.json` para corrigir `source-map-js`; não mudou storage.
- Desde `635d63c` (01/10/2026), `storeImage` chamava `putR2`. Sem qualquer variável R2, `r2Storage()` retornava `null`, `putR2()` retornava `false` e a imagem era gravada silenciosamente em `storage/uploads` (ou `UPLOAD_DIR`) **no servidor**. Configuração parcial e erros de PUT lançavam erro, sem fallback.
- Antes de `635d63c`, todos os uploads de imagens eram locais. A pasta padrão está dentro do projeto e é ignorada pelo Git. Não existe cópia automática dela no R2 nem garantia de volume persistente no código.
- Na configuração de produção relatada, o fallback local era o caminho executado. O banco persistente podia sobreviver à substituição da aplicação enquanto os arquivos locais ficavam indisponíveis. Isso confirma a falha arquitetural e a contribuição da ausência das variáveis; não identifica, sem logs da hospedagem, o comando que removeu cada arquivo nem comprova que todo restart simples apaga disco.
- A documentação oficial da Hostinger confirma sobrescrita dos arquivos ao trocar o repositório, mas não permite inferir o comportamento de todo restart/rebuild: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Produção/local podem ter ambientes ou buckets distintos. Não há metadados antigos de provider/bucket para reconstruir isso retroativamente. Os testes atuais confirmaram leitura e escrita no bucket configurado em ambos os ambientes; não demonstram configuração histórica.

## Fluxo anterior, comprovado pelo código

Manual: `NewsForm`/`TaxonomyForm` → `ImageUpload` → `FileUpload` → POST `/api/editorial/upload` com `body: File` → normalização por Sharp → `storeImage` → R2 **ou disco**, conforme ambiente → transação `media_assets` + `media.upload` → HTTP 201 com `/media/<UUID>.webp` → estado React/hidden input → salvamento da reportagem/foto.

O arquivo saía do computador do usuário. `FileUpload` só chamava `onChange(url)` após resposta de sucesso. Não salvava base64/Blob URL. Existe um componente alternativo `EditorialImageUpload` com `createObjectURL`, mas ele não é usado pelos formulários examinados; também só repassa a URL após resposta backend. Trocar computador ou país não elimina os bytes já enviados ao servidor. Fechar a página durante envio pode abortar o upload, sem criar uma referência nova válida.

Era possível clicar em salvar enquanto um envio estava pendente: salvava-se a referência anterior ou uma capa vazia, não o Blob nem um UUID futuro. O novo formulário bloqueia isso. O backend anterior aguardava gravação antes do INSERT, mas validava apenas a linha de `media_assets` ao salvar notícia, não o objeto físico.

Importação anterior: `importArticle` → download HTML com proteção SSRF → `extractArticle` → texto e `external_image_url` apenas para consulta. **Não baixava imagens**, não criava `media_assets` e exigia upload manual. `news.import` era registrado ao salvar a notícia; `media.upload` correspondia ao envio separado. Imagens externas no corpo são removidas pelo renderizador; capas aceitam somente `/media/...`. Portanto, retirar a matéria externa não apagava a cópia local/R2 já enviada; o risco estava na persistência do storage.

Comparação consultada:

- Raphinha (`a23c9006-4c76-427c-ade1-99a66ab4cf5d`): `news.import`, capa `4434627f-900a-474c-b02c-5e41bb93026e.webp`, upload em 30/09/2026, arquivo local/public disponível e originalmente ausente no R2. Agora copiado sem alteração de bytes.
- Incêndio em Caxias (`6def9d68-87ed-4a74-a344-82fb8388fa6f`): `news.import`, capa `599e61a4-adeb-4d5d-ba1a-a46f75a9e690.webp`, upload registrado, original ausente local/R2, equivalente recuperado anteriormente da fonte e disponível no R2. Nenhum dos dois eventos antigos registra URL original do arquivo/provider.

## Foto do jornalista e camadas compartilhadas

- Foto do autor: `authors.photo_url`. `TaxonomyForm` usa o mesmo `ImageUpload`, endpoint, `media_assets` e `/media` das notícias. O rodapé da matéria usa esse campo por JOIN com `authors`.
- Raimundo Inacio: autor `4132f5c1-7d1d-44b4-b974-693da167dd4d`; foto `/media/f0cf6675-b506-4b12-a6bb-70ff6f85ad15.webp`; asset `ba9eafa6-4b73-4f30-a4b3-a6c90fefb122`, 171800 bytes, upload registrado em 05/10/2026. Ausente local/public/R2; HTTP 404 local e produção. Não foi substituída.
- A foto de Leonardo (`7c9c5cb9-4b83-4594-b164-4a1861bfc75a.webp`) estava disponível local/public e foi copiada para R2, sem alterar o cadastro.
- A tabela `users` não possui campo de foto/avatar. `presenters.photo_url` é outra referência de perfil, sem upload separado neste fluxo.
- `/api/ads/upload` delega ao endpoint editorial existente. Por isso, seus novos uploads também recebem a persistência R2 obrigatória, sem alterar lógica, conteúdo ou layout de anúncios. Não foram feitas mutações em anúncios.

## Fluxo corrigido

1. Backend valida tamanho/MIME/bytes e normaliza para WebP (até 2400px, qualidade 85, regras existentes).
2. Gera UUID, aguarda PUT `media/<UUID>.webp` e confirma HEAD com tamanho e MIME.
3. Só então grava `media_assets` e audit log na mesma transação. Resposta 201 somente após COMMIT.
4. Sem R2, PUT com erro ou HEAD inconclusivo: upload falha, sem sucesso no banco ou escrita local.
5. Falha antes do COMMIT limpa apenas o novo UUID. Se a confirmação do COMMIT se perder, os bytes são preservados: evita excluir uma imagem potencialmente já referenciada.
6. Novos audits registram `storageProvider`, `objectKey`, `size`, `mimeType`, `sourceType`, `sourceHost` quando importado e `createdAt`. Nunca registram credenciais.
7. Importação baixa a capa identificada no backend, revalida DNS/redirects, limita tempo/5MB/MIME e usa a mesma persistência. Só entrega `cover_image` ao formulário após confirmação. Não importa automaticamente imagens internas externas nem faz hotlink; o corpo extraído permanece textual.
8. Salvamento verifica registro e HEAD do objeto para capa, imagens efetivamente renderizadas no corpo (inclusive Markdown por referência) e foto do autor. Foto de autor também é verificada ao salvar o cadastro. Falha retorna erro administrativo claro. Nenhuma notícia existente é alterada automaticamente.
9. `/media` lê imagens por GET autenticado S3/R2, independente do hostname público/CDN. Produção não lê `storage/uploads` como fallback. Desenvolvimento pode ler arquivos legados se o objeto estiver ausente; novas escritas continuam exigindo R2.

As imagens enviadas/copiadas deixam de depender da disponibilidade da matéria externa. Isso não substitui backup do bucket ou proteção operacional contra exclusão/configuração incorreta.

## Configuração e ferramentas

O helper atual exige `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` e pelo menos um entre `R2_ACCOUNT_ID`/`R2_ENDPOINT`. Endpoint padrão: `https://<account>.r2.cloudflarestorage.com`; prefixo de imagens: `media/`. Configurar cada ambiente separadamente, sem `NEXT_PUBLIC_`. `.env.local` não foi alterado.

```shell
node scripts/check-editorial-media.mjs --health
node scripts/check-editorial-media.mjs --path /media/<UUID>.webp
```

O primeiro usa HEAD do bucket. O segundo consulta somente os caminhos explícitos (máximo 20), compara registro/HEAD e informa `registered`, `exists`, `usable` e divergência de metadados. `inspectEditorialImage` oferece a mesma verificação ao backend. Falhas de acesso são erros, não falsos resultados de ausência.

Para copiar um legado disponível, sem mudar banco, UUID, URL ou bytes:

```shell
node scripts/check-editorial-media.mjs --copy-local --path /media/<UUID>.webp
```

Exige registro existente, arquivo WebP e tamanho registrado compatível; PUT condicional impede sobrescrita; HEAD confirma a cópia. Não remove arquivos locais. Não há migração SQL: a chave deriva do path existente; metadata fica no audit log.

Sete imagens ainda disponíveis e referenciadas por notícias/autores foram copiadas com esse controle: `84f16ea6`, `09139f4f`, `4434627f`, `b03290f2`, `acc147e3`, `82a31938`, `7c9c5cb9` (prefixos dos UUIDs). As cinco recuperadas anteriormente foram preservadas. As três imagens A/B e a foto de Raimundo continuam ausentes, com seus registros intactos.

## Validação realizada, sem build ou deploy

- TypeScript aprovado; lint direcionado; 13 testes direcionados de storage, validação editorial, serviço de persistência e importação.
- Testes incluem ausência de configuração, falha PUT/HEAD/banco, COMMIT ambíguo, proteção contra referência fantasma, foto de autor ausente, Markdown por referência, SSRF/DNS/redirects, MIME, tamanho e timeout.
- Local, com o código corrigido: imagem temporária de notícia e avatar pelo endpoint autenticado; HEAD, GET 200, bytes WebP, `media_assets` e metadata do audit confirmados. Importação de `https://www.w3.org/Icons/w3c_home.png` pelo helper real confirmada no R2/GET/banco/audit; sem publicar notícia.
- Produção, com a versão já publicada pelo usuário: após GET 200 de objetos exclusivamente R2, upload temporário de notícia e avatar confirmados por HEAD no bucket configurado, GET 200 e banco. Isso valida a configuração atual de leitura/escrita, **não significa que esta correção foi publicada**.
- Todos os objetos, registros, audits e sessões temporários desses testes foram removidos por seus IDs exclusivos; nenhuma notícia, usuário ou mídia real foi apagada.
- As cinco recuperadas anteriormente respondem HTTP 200 local e produção; imagem antiga de notícia e foto antiga disponível também respondem 200. A foto de Raimundo continua 404.
- Nenhum commit, push, deploy, upgrade de dependências ou build completo foi executado. As garantias novas só passam a valer em produção quando o usuário publicar esta versão.

## Arquivos desta correção

- Storage/backend: `server/services/storage.ts`, `server/services/r2-storage.mjs`, `server/services/editorial-media.ts` (novo), `server/services/import-editorial-image.ts` (novo), `server/services/editorial.ts`.
- Entradas: `app/api/editorial/upload/route.ts`, `app/admin/import-action.ts`, `app/media/[filename]/route.ts`.
- Formulários: `components/editorial/file-upload.tsx`, `image-upload.tsx`, `markdown-editor.tsx`, `news-form.tsx`, `news-composer.tsx`, `taxonomy-form.tsx`.
- Validação/download: `lib/security/remote-page.mjs`, `lib/editorial/content.mjs`, `lib/editorial/import-types.ts`.
- Operação/configuração: `scripts/check-editorial-media.mjs` (novo), `.env.example`, `README.md`, este relatório (novo).
- Testes: `tests/editorial-media.test.mjs` (novo), `tests/storage.test.mjs`, `tests/editorial.test.mjs`, `tests/importer.test.mjs`.

Alterações preexistentes em termos de uso/manuais não fazem parte deste trabalho e foram preservadas. Nenhuma migração de esquema foi necessária.
