# Mídia no chat — situação nesta demonstração

Fotos e vídeos permanecem desabilitados. A interface pública de envio mostra os controles indisponíveis e informa que a participação continua por texto. Nenhum arquivo de visitante é recebido ou armazenado.

O chat atual persiste somente texto (`chat_messages.message`) e a API aceita operações textuais. Não existe vínculo de anexo que permita ocultar ou excluir logicamente uma imagem junto da mensagem. O storage atual escreve no diretório local definido por `UPLOAD_DIR`; o código não garante persistência desse volume entre deploys. Ativar anexos agora exigiria mudanças em banco, storage e moderação, fora do escopo autorizado.

Antes de ativar fotos, será necessário garantir storage persistente, vincular anexos às mensagens e aplicar a mesma visibilidade na consulta pública e na moderação administrativa. O upload público deverá validar bytes reais, MIME, extensão, dimensões, tamanho, nomes gerados pelo servidor, autorização e limites de envio. Prioridade: JPG/PNG/WEBP até 5 MB. Vídeo ficará para depois dessa base, com validação própria para MP4/WEBM e limite definido (sugestão: 25 MB).

O upload editorial continua usando o endpoint existente: validação de conteúdo real com Sharp, MIME/extensão compatíveis, limite de 5 MB/20 megapixels, conversão para WebP e nome UUID. O novo seletor acrescenta validação inicial e preview no navegador, sem substituir a validação do servidor e sem alterar o storage. Os previews temporários são liberados após o envio ou desmontagem. Publicidade mantém seu seletor anterior.
