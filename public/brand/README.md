# Marca oficial Biosfera

Os arquivos oficiais possuem transparência alpha e dimensões próprias: original 2172 × 724; versão clara 1916 × 821. Nenhum deles é modificado pelo portal.

- `biosfera-logoclaro1.png`: header, rádio ao vivo, footer e sidebar administrativa sobre fundos escuros.
- `biosfera-logo.png`: login (card claro) e estados institucionais sobre fundos claros.

Os caminhos ficam em `lib/brand.ts`. O componente `components/brand.tsx` seleciona a versão clara com a propriedade `light` e usa `next/image`, dimensões intrínsecas e texto alternativo.

As larguras responsivas ficam em `app/visual-refresh.css`. A marca aparece diretamente sobre a seção, sem fundo, padding, borda, arredondamento ou sombra no wrapper. A antiga classe `brand-logo-surface` foi removida do componente; seu fundo branco já havia sido removido do CSS.
