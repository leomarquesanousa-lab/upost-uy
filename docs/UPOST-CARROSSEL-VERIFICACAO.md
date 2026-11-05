# Carrossel 70/30 — verificação e configuração

## Diagnóstico confirmado

O carrossel já existia em `components/ads/top-banners.tsx` e era o primeiro bloco
da homepage, imediatamente após o MarketTicker e antes das manchetes. Os estilos
já definiam 120 px, raio de 10 px, grid 70/30 e empilhamento móvel de 100 px.

A consulta ao Neon exclusivo do UPOST confirmou cinco posições legadas e nenhuma
campanha. As posições `HOME_TOP` e `HOME_SIDEBAR` estavam ausentes. A resposta vazia
do inventário fazia o componente retornar `null`, conforme a regra de não deixar
um espaço público vazio.

## Correção executada

- Criadas e ativadas somente `HOME_TOP` e `HOME_SIDEBAR`, pelo serviço existente,
  com auditoria e conferência prévia da identidade do banco. Nenhuma campanha criada.
- Script reutilizável `scripts/configure-top-ad-slots.mjs`: sem argumentos faz
  diagnóstico; `--commit` cadastra somente posições ausentes. Reexecução confirmou
  `missing: []`, sem duplicatas e preservando posições existentes/desativadas.
- Painel existente agora mostra o estado de cada posição, campanhas disponíveis,
  instruções de imagem e atalhos de cadastro com a posição já selecionada.
- O campo de prioridade existente controla a ordem, sem nova coluna no banco.
- Salvar a configuração da posição atualiza o estado exibido no painel.
- Homepage consulta o inventário ao recuperar foco/visibilidade, além do ciclo de
  um minuto, para reconhecer campanhas ativadas em outra aba sem editar código.

Não houve alteração de schema ou execução de migração. O MarketTicker não foi alterado.

## Como publicar banners reais

Em `/admin/publicidade`, usar “Cargar banner del carrusel” ou “Cargar anuncio lateral”.
Informar nome interno, anunciante, imagem (e versão móvel opcional), texto alternativo,
URL de destino, início vigente, prioridade e estado ativo. A posição vem selecionada.
Para ordenar o carrossel, usar prioridades diferentes: o número maior aparece primeiro.

Artes recomendadas: 850×120 para carrossel, 350×120 para lateral, 400×100 para celular,
ou múltiplos proporcionais. O portal preserva a imagem inteira com `object-fit: contain`.

Após salvar, abrir a homepage ou retornar à aba dela. Sem anúncio lateral, o carrossel
ocupa 100%. Sem qualquer campanha disponível, o bloco não ocupa espaço público.

## Resultado e limite de conteúdo

Estado final confirmado: duas posições ativas; zero campanhas em ambas.
Para a exibição pública real ainda faltam as artes e links de destino, solicitados
ao usuário. Nenhum anunciante, imagem publicitária ou campanha foi inventado.

Os testes de navegador cobrem estado vazio, 70/30, quatro larguras (1440, 1024, 768,
390), controles, rotação, pausa, movimento reduzido e aparecimento ao retornar do painel.
Os cenários com imagens usam fixtures marcadas “PRUEBA VISUAL · NO PUBLICADA”, restritas
ao Playwright; não foram gravadas no banco nem nos arquivos públicos.

## Arquivos desta tarefa

- `scripts/configure-top-ad-slots.mjs`
- `app/admin/(protected)/publicidade/page.tsx`
- `app/admin/(protected)/publicidade/[id]/page.tsx`
- `app/admin/(protected)/publicidade/advertising.module.css`
- `components/admin/ad-form.tsx`
- `components/ads/top-banners.tsx`
- `tests/header/top.spec.ts`
- Este documento.

Sem alterações na Biosfera, faixa financeira, DNS, credenciais, push ou deploy.
