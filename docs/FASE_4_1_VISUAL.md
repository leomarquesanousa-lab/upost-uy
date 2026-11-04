# Fase 4.1 — identidade visual

1. Arquivos principais: app/design-tokens.css, app/visual-refresh.css, app/globals.css, components/brand.tsx, lib/brand.ts, components/layout/public-header.tsx, components/layout/public-shell.tsx, components/radio/radio-wave.tsx, components/radio/radio-player.tsx, layouts público/admin e login.
2. Tokens: navy, azul, ciano, branco e cinza frio; texto, erro, foco, superfícies, espaçamentos, raios, sombras, transições e altura do player.
3. Header: logo oficial completo, navegação compacta, busca, botão conectado ao áudio e menu mobile.
4. Home: preservada a ordem rádio/grade, notícias, câmera/chat e pedido musical; mais hierarquia e respiro.
5. RadioWave: barras CSS reutilizáveis; animação somente ao reproduzir; respeita redução de movimento.
6. Player: único elemento de áudio persistente, metadados de programa/apresentadores, controles compartilhados e espaço inferior reservado. Consulta da grade centralizada no provedor usando a API existente.
7. Notícias: imagens proporcionais, títulos editoriais, categorias e leitura mais confortável.
8. Câmera: novo pôster navy; iframe continua sendo carregado somente por clique.
9. Chat: balões distintos para público/equipe e campos legíveis.
10. Pedido musical: gradiente claro, tipografia e campos com área confortável.
11. Footer: navy, logo transparente diretamente sobre navy, links reais e copyright. Sem perfis sociais inventados.
12. Admin: sidebar navy, marca oficial, cards, tabelas e formulários claros; autenticação e permissões preservadas.
13. Mobile: home em coluna, menu expansível, player compacto e marca inteira em desktop/tablet/mobile.
14. Acessibilidade: alt Biosfera Rádio TV Web, foco visível, navegação por teclado, controles rotulados e prefers-reduced-motion.
15. Performance: next/image com dimensões intrínsecas 2172 × 724, sem biblioteca de animação ou dependência nova; imagem original preservada, sem filtros ou versões artificiais.
16. Validação: lint, TypeScript, build, testes unitários e E2E existentes, mais captura responsiva. Resultados finais registrados na entrega.
17. Escopo: somente Fase 4.1. Sem alteração de schema, migrations, regras de negócio ou implantação. E2E utiliza uma base temporária local independente.

## Logo oficial

Arquivo: public/brand/biosfera-logo.png. Uso centralizado no Brand, com caminho em lib/brand.ts. Aplicado no header público desktop/mobile, rádio da home, footer, login e sidebar/layout administrativo compartilhado por dashboard, Minha Conta e demais telas. Estados institucionais também usam o componente. O texto informativo do player e mensagens da equipe continua sendo conteúdo, não uma assinatura provisória.

## Resultado da validação

Lint, TypeScript e build aprovados. 20 testes unitários e 18 testes E2E funcionais existentes aprovados. O teste adicional de identidade/responsividade foi aprovado após correções dos fundos decorativos e da largura mínima da sidebar. Verificadas larguras 1440, 768, 390 e 320 px sem rolagem horizontal na home; admin mobile em 390 px. Capturas em test-results/visual-*.png (artefatos locais ignorados pelo Git).
