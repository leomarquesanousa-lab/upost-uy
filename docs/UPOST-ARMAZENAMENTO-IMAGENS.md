# Imagens editoriais do UPOST

## Estado verificado em 4 de novembro de 2026

As cinco fotos da carga inicial foram baixadas, normalizadas para WebP e salvas em
`storage/uploads` (caminho absoluto neste ambiente: `C:\tech\upost-uy\storage\uploads`).
O banco referencia `/media/<uuid>.webp`. As URLs externas no relatório
`UPOST-FOTOS-RESULTADO.json` identificam a origem; não são hotlinks usados pelos cards.
Nenhuma das seis variáveis R2 abaixo está preenchida em `.env.local`.

## Fluxo existente

- `lib/editorial/import-article.mjs` e `cover-images.mjs`: descoberta das imagens.
- `lib/editorial/import-images.mjs`: importação das candidatas.
- `server/services/editorial-media.ts`: download seguro, normalização, validação,
  registro da mídia e preservação dos créditos.
- `server/services/storage.ts`: escolha do provedor, escrita e verificação dos bytes.
- `server/services/r2-storage.mjs`: cliente S3 compatível com Cloudflare R2,
  PUT/HEAD/GET/DELETE e verificação de acesso ao bucket.
- `app/media/[filename]/route.ts`: entrega da imagem no endereço estável `/media/...`.

Sem qualquer variável R2, desenvolvimento usa disco local. Produção exige R2.
Configuração parcial gera erro em qualquer ambiente; uma falha no R2 configurado
também gera erro, sem gravar silenciosamente no disco local. Portanto, as variáveis
não são ignoradas. As imagens locais não são persistência adequada para produção.

## Ativação posterior do R2

Configurar no ambiente exclusivo do UPOST, sem publicar segredos no repositório:

| Variável | Uso no código atual |
| --- | --- |
| `R2_ACCOUNT_ID` | Conta; obrigatório se não houver endpoint explícito |
| `R2_ENDPOINT` | Alternativa ao account ID; endpoint HTTPS S3 do R2 |
| `R2_ACCESS_KEY_ID` | Chave com acesso ao bucket UPOST |
| `R2_SECRET_ACCESS_KEY` | Segredo correspondente |
| `R2_BUCKET_NAME` | Bucket exclusivo do UPOST |
| `R2_PUBLIC_URL` | URL HTTPS da base pública, exigida pela configuração compartilhada atual |

Para imagens editoriais, a leitura é assinada pelo SDK através de `/media/...`;
não depende de buscar o arquivo pela URL pública. O fluxo compartilhado de vídeos
utiliza a base pública, por isso ela continua obrigatória no código atual.

Antes de ativar em produção:

1. Criar/configurar o bucket e credenciais do UPOST, com permissão para as operações
   de leitura, escrita, verificação e remoção utilizadas pelo serviço.
2. Copiar as cinco imagens locais para chaves `media/<mesmo-uuid>.webp`, com
   `Content-Type: image/webp`, preservando os nomes do relatório. Não é necessário
   alterar as URLs do banco.
3. Verificar tamanho, conteúdo e leitura dos cinco objetos, além de `checkR2Health()`.
4. Configurar as variáveis no processo servidor e reiniciá-lo em ambiente de teste.
5. Validar `/media/...`, homepage e matérias, e testar um novo upload com confirmação
   HEAD. Manter os arquivos locais até concluir a conferência.

Configurar credenciais não transfere automaticamente as imagens existentes. Em
produção não há fallback local de leitura; os objetos devem estar no bucket antes.
Nenhum bucket, DNS, variável, objeto R2 ou dado do banco foi alterado nesta tarefa.
