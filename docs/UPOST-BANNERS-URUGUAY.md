# Carrossel — fotografias do Uruguai

Implementado em 05/11/2026 exclusivamente no UPOST.uy.

- HOME_TOP contém três campanhas ativas, nesta ordem: Punta del Este, Colonia del Sacramento e Termas de Salto (Termas del Arapey).
- A campanha anterior foi desativada; seu registro e arquivo permanecem preservados. Backup dos registros anteriores em `storage/backups/home-top-before-uruguay-*.json` (ignorado pelo Git).
- Fotografias copiadas para o armazenamento existente do portal, sem hotlink. Neste ambiente, arquivos WebP em `storage/uploads`, servidos por `/media/…`. Se o R2 estiver configurado, o mesmo serviço o utiliza.
- Cada campanha tem imagem desktop 1720×336 e mobile 900×300. Recortes próprios, sem textos embutidos, com `object-fit: cover`.
- Fade de 600 ms, rotação de 6 segundos, sem translação lateral. Pausa por hover, foco e interação manual; movimento reduzido desativa a animação e a rotação automática.
- Alturas, grid 70/30, rádio, cabeçalho, mercados e notícias preservados.

## Fontes e créditos

Os créditos aparecem discretamente nas imagens e apontam para as páginas de origem, com suas licenças. Recorte e conversão WebP indicados; os derivados seguem a licença da fotografia original.

1. [Punta del Este — Jimmy Baikovicius](https://commons.wikimedia.org/wiki/File:Punta_del_Este_over_Mavic_Air_2_201229-0034-jikatu-Pano_(50775281962).jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
2. [Farol de Colonia — Diego Delso](https://commons.wikimedia.org/wiki/File:Faro_de_Colonia_del_Sacramento,_Uruguay1.JPG), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
3. [Termas del Arapey, Salto — Alejgon](https://commons.wikimedia.org/wiki/File:Termas_del_Arapey._Salto._Uruguay._15.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Operação

`node scripts/replace-uruguay-banners.mjs` verifica o banco exclusivo e prepara/inspeciona as imagens sem gravar campanhas. `--commit` faz a substituição autorizada apenas em HOME_TOP, em transação, com auditoria e backup. Reexecuções reutilizam campanhas e mídia existentes. O manifesto está em `scripts/uruguay-banners.json`; os banners continuam editáveis em `/admin/publicidade`. Nenhuma migração é executada.

## Validação

TypeScript, build e 49 testes unitários aprovados. ESLint sem erros, com dois avisos preexistentes em componentes não relacionados. Os 16 testes existentes do topo passaram. Quatro testes adicionais verificam as três fotos reais em 1440, 1024, 768 e 390 px, inclusive sobreposição de opacidades durante o fade, ausência de transformações e scroll horizontal, mídia mobile, créditos e alinhamento com a rádio. Capturas em `test-results/header/uruguay-banners-*`.
