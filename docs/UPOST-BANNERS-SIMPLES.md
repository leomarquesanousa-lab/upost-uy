# Cadastro simples de banners

Em `/admin/publicidade`, “Cargar banner del carrusel” abre somente seleção/arraste
de imagem, prévia e “Guardar banner”. O atalho lateral usa a mesma experiência.

O backend usa as tabelas existentes e preenche automaticamente:

- Nome e anunciante internos: UPOST.uy.
- Posição do atalho (`HOME_TOP` por padrão; `HOME_SIDEBAR` para lateral).
- Data inicial: instante do cadastro. Data final: nenhuma.
- Banner ativo, com a posição habilitada.
- Destino vazio: imagem sem link, sem clique ou redirecionamento artificial.
- Ordem automática: inserção após os banners de prioridade maior e, entre iguais,
  ordem de criação. Todas as imagens ativas entram no carrossel, sem limite artificial de 12.

Ações de autenticação, autorização administrativa, mesma origem, validação do upload,
sanitização do caminho de mídia e auditoria foram preservadas. Um caminho de mídia
não cadastrado é rejeitado. Não há alteração de schema ou migração executada.

As miniaturas permitem substituir imagem, ativar/desativar, mover acima/abaixo e excluir.
Substituir modifica somente a imagem do banner existente, preservando os demais dados
da campanha. Excluir remove o banner e os recibos associados; não apaga arquivos da
biblioteca que possam estar sendo utilizados em outros conteúdos.

Campanhas existentes continuam preservadas. O formulário antigo de edição permanece
em “Configuración avanzada (opcional)”, recolhido por padrão. Sua URL também é opcional.
Impressões continuam sendo contabilizadas para banners sem link; o endpoint de clique
recusa banners que não tenham destino.

## Verificação executada

`node scripts/test-simple-banners.mjs` testa login normal com conta ADMIN temporária,
envio de apenas uma imagem, gravação no Neon exclusivo do UPOST, exibição real sem link,
substituição, ativação/desativação, ordenação, lateral e exclusão via interface.

O script verifica a identidade do banco antes de conectar. Ao terminar, remove somente
os banners, mídias e a conta de teste que ele próprio criou. Não altera senhas nem
sessões de usuários existentes. Mantém a auditoria. As capturas ficam em
`test-results/simple-banners/`; são evidência de teste, não conteúdo publicado permanente.

O relatório final confirmou todas as etapas e a limpeza. O inventário anterior de
campanhas foi preservado. A faixa financeira, Biosfera, DNS e credenciais não foram alterados.

## Arquivos

- `server/services/simple-banners.ts`: cadastro e gerenciamento.
- `server/services/ads.ts`: veiculação sem destino e ordem automática.
- `app/admin/operations-actions.ts`: ações protegidas e revalidação pontual.
- `components/admin/simple-banner-form.tsx` e `simple-banners.module.css`.
- `components/admin/ad-form.tsx`: URL opcional na configuração avançada.
- `app/admin/(protected)/publicidade/page.tsx` e `[id]/page.tsx`.
- `components/ads/creative.tsx`: imagem sem comportamento de link.
- `components/ads/top-banners.module.css`: indicadores contidos para inventários maiores.
- `scripts/test-simple-banners.mjs` e este documento.

Sem push ou deploy.
