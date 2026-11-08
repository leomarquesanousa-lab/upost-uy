# Medios Públicos - fonte automática

Uma única fonte usa os quatro RSS oficiais publicados nas páginas de tags Nacionales, Internacionales, Cultura e Deportes. O cadastro conserva o RSS geral de Noticias como referência; um RSS personalizado salvo pelo administrador é respeitado.

- Mapeamento: Nacionales → Uruguay; Internacionales → Mundo; Cultura → Cultura; Deportes → Deportes. Itens sem a categoria Noticias ou sem uma dessas tags são ignorados.
- Os feeds são intercalados e deduplicados antes da importação. A fila consulta até vinte fontes por rodada para a quarta não ficar bloqueada por fontes cuja cota já acabou. Permanecem o teto global configurado (20/dia), a cota de 5/dia por fonte, o limite de ativas e o intervalo mínimo de 60 minutos.
- Fotos vêm de OG/Twitter/JSON-LD ou da `.thumb` da matéria. Logotipos, ícones, banners e imagens relacionadas são descartados. O texto é extraído de `.single-cont`, evitando navegação e tempo de leitura nos resumos. O resumo publicado inclui nome, link e atribuição original disponíveis; não publica o texto integral.
- O gzip ocasional do servidor é aceito somente por opção explícita para esta fonte, com limites tanto na resposta compactada quanto na descompressão. SSRF, DNS fixado, redirects validados, MIME e timeout permanecem ativos.
- Mesmos fluxos existentes de storage, deduplicação/tombstones, expiração, permanência e lixeira. Sem migração de banco.

Teste sem publicação: `node scripts/register-medios-publicos.mjs`. Ele consulta os RSS, valida uma matéria e uma fotografia por editoria em memória e registra o diagnóstico em `test-results/medios-publicos/` (ignorado pelo Git). Não cria notícias nem envia fotos ao R2.

Após validar e publicar o código: `node scripts/register-medios-publicos.mjs --activate` cria apenas os dois registros necessários, com fonte e automação ativas, resumo, publicação automática após os controles editoriais existentes, até 4 itens por execução e 5/dia. A primeira consulta fica agendada para depois do intervalo mínimo. Não altera fontes existentes, notícias nem o teto global. Reexecutar preserva um cadastro já existente.

No painel: **Fuentes automáticas → Medios Públicos → Editar configuración / Sincronizar ahora**. A ativação utiliza o agendamento já existente; não instala outro cron.
