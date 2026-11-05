# Carga inicial executada no UPOST

Cinco matérias reais foram verificadas nas páginas originais e em RSS oficiais e cadastradas como PUBLISHED no Neon configurado pelo UPOST. A carga contém somente sínteses curtas produzidas a partir da informação disponível e links de origem; nenhum corpo integral ou fotografia foi copiado.

## Matérias cadastradas
Datas e horários originais em America/Montevideo:

| Editoria | Matéria | Veículo | Publicação |
| --- | --- | --- | --- |
| Uruguay | [Meteorólogo advierte por ciclón extratropical en 4 departamentos uruguayos: cuándo y dónde](https://www.montevideo.com.uy/Noticias/Meteorologo-advierte-por-ciclon-extratropical-en-4-departamentos-uruguayos-cuando-y-donde-uc980927) | Montevideo Portal | 03/11/2026 20:02 |
| Deportes | [Nacional enfrenta a Ferro Carril en octavos de la Copa AUF Uruguay: “No los subestimamos”](https://www.montevideo.com.uy/Deportes/Nacional-enfrenta-a-Ferro-Carril-en-octavos-de-la-Copa-AUF-Uruguay--No-los-subestimamos--uc980933) | Montevideo Portal | 03/11/2026 20:38 |
| Sociedad | [La superficie urbanizada de Uruguay creció 125% entre 1985 y 2025](https://ladiaria.com.uy/ciencia/articulo/2026/11/la-superficie-urbanizada-de-uruguay-crecio-125-entre-1985-y-2025/) | la diaria | 04/11/2026 00:19 |
| Mundo | [Protestas en Albania: el águila contra los flamencos](https://ladiaria.com.uy/mundo/articulo/2026/11/protestas-en-albania-el-aguila-contra-los-flamencos/) | la diaria | 04/11/2026 00:19 |
| Cultura | [Vuelve Zafhfaroni, la legendaria banda uruguaya de jazz-rock fusión](https://ladiaria.com.uy/cultura/articulo/2026/11/vuelve-zafhfaroni-la-legendaria-banda-uruguaya-de-jazz-rock-fusion/) | la diaria | 03/11/2026 10:35 |

O feed esportivo usa um offset diferente da página. A data local visível 03.11.2026 20:38 foi conferida no HTML original e convertida pelo fuso uruguaio, em vez de trocar o horário original pelo horário divergente do RSS.

El Observador e El País recusaram consultas pelo transporte seguro; foram substituídos por fontes acessíveis, sem contornar os bloqueios. Nenhuma permissão verificável de reutilização de fotografias foi identificada para esta carga. Todos os cinco cards estão sem fotografia e sem imagem substituta.

## Banco e preservação
- DATABASE_URL foi lido apenas das configurações existentes do projeto UPOST.
- Confirmados: provedor Neon, SITE_NAME UPOST.uy, banco neondb, OWNER ativo, oito migrações e banco editorial inicialmente vazio.
- A conexão foi fixada pelo fingerprint 28fefbfb8169c488 antes de qualquer gravação. Nenhuma senha ou URL de conexão foi registrada.
- Criadas cinco notícias, cinco categorias e um autor editorial Redacción UPOST.uy para atribuir as sínteses, além das entradas de auditoria existentes.
- O CLI reutiliza saveNews, saveTaxonomy, newsInput, o extrator de artigos e as proteções de URL/DNS/timeout do importador existente.
- Nenhuma conta de usuário, tabela, coluna, migração ou configuração do cabeçalho foi alterada.
- Uma segunda execução ignorou as cinco URLs já cadastradas. Continuaram existindo exatamente cinco notícias públicas.
- O projeto Biosfera, suas credenciais e seu banco não foram acessados. Sem push ou deploy.

## Reutilização
Prévia sem gravação:

```text
node scripts/import-initial-news.mjs
```

Aplicar a seleção verificada, ignorando URLs já cadastradas:

```text
node scripts/import-initial-news.mjs --commit
```

A seleção está em scripts/initial-news.json. Para uma carga futura, atualizar as URLs, títulos, datas, editorias e sínteses desse manifesto. O script recusa datas futuras, matérias com mais de sete dias e uma conexão Neon diferente da previamente verificada. Não há agendamento automático.

## Arquivos desta execução
Criados:
- scripts/import-initial-news.mjs
- scripts/initial-news.json
- lib/editorial/initial-import.mjs
- tests/initial-import.test.mjs
- playwright.news.config.ts
- tests/public-news/initial-news.spec.ts
- docs/UPOST-CARGA-INICIAL.md

Modificados:
- lib/security/remote-page.mjs — suporte a RSS/XML no mesmo transporte protegido.
- components/editorial/news-card.tsx — fonte e data no card; ausência real de imagem quando não há foto.

## Verificação
- 42 testes unitários aprovados.
- TypeScript aprovado.
- ESLint sem erros, com dois avisos preexistentes em componentes não alterados.
- Build local aprovado; sem publicação.
- Três testes de navegador aprovados: homepage a 1440 e 390 px, cinco títulos/sínteses/fontes/datas/categorias, ausência de duplicatas e fotos, ausência de overflow horizontal e abertura das cinco páginas internas com links originais.
- Nenhum erro de JavaScript observado na homepage. As APIs foram bloqueadas nos testes para evitar gravações de publicidade.
- Capturas: test-results/initial-news/initial-news-five-imported-2d25f-t-invented-images-at-1440px/home-1440.png e test-results/initial-news/initial-news-five-imported-c7808-ut-invented-images-at-390px/home-390.png.
