import type { Metadata } from 'next';

import Link from 'next/link';

export const metadata: Metadata = {
  title:
    'Política de Cookies | Biosfera Rádio TV Web',
  description:
    'Informações sobre cookies utilizados pelo Portal Biosfera Rádio TV Web.',
};

export default function Page() {
  return (
    <article
      style={{
        maxWidth: '860px',
        margin: '0 auto',
        paddingBottom: '60px',
      }}
    >
      <p className="eyebrow">
        PRIVACIDADE
      </p>

      <h1>
        Política de Cookies
      </h1>

      <p>
        Última atualização:
        1º de outubro de 2026.
      </p>

      <p>
        Esta política explica como
        o Portal Biosfera Rádio TV
        Web utiliza cookies e
        tecnologias semelhantes
        durante a sua navegação.
      </p>

      <h2>
        1. O que são cookies
      </h2>

      <p>
        Cookies são pequenos
        arquivos ou registros
        utilizados por sites e
        serviços digitais para
        armazenar informações
        relacionadas à navegação e
        às preferências do usuário.
      </p>

      <h2>
        2. Cookies utilizados
      </h2>

      <p>
        O portal pode utilizar
        cookies necessários para
        segurança, navegação,
        funcionamento do site e
        registro das suas
        preferências.
      </p>

      <p>
        Também podem ser utilizados,
        quando autorizados, cookies
        de análise e desempenho para
        compreender como o portal é
        utilizado e melhorar a
        experiência dos visitantes.
      </p>

      <p>
        O portal pode utilizar
        serviços como Google
        Analytics para essa
        finalidade.
      </p>

      <h2>
        3. Publicidade
      </h2>

      <p>
        Quando autorizados, cookies
        relacionados à publicidade
        podem ser utilizados para
        disponibilizar anúncios,
        medir resultados e melhorar
        a experiência publicitária.
      </p>

      <p>
        O portal pode utilizar
        serviços como Google
        AdSense.
      </p>

      <h2>
        4. Serviços de terceiros
      </h2>

      <p>
        Players de vídeo, serviços
        de streaming, redes sociais
        e outros conteúdos externos
        podem utilizar tecnologias
        próprias quando carregados
        ou utilizados pelo
        visitante.
      </p>

      <h2>
        5. Suas escolhas
      </h2>

      <p>
        O visitante pode aceitar,
        recusar ou personalizar os
        cookies opcionais por meio
        das opções apresentadas pelo
        portal.
      </p>

      <p>
        A escolha poderá ser
        alterada posteriormente
        utilizando a opção
        “Preferências de cookies”
        disponível no rodapé.
      </p>

      <p>
        Também é possível excluir
        ou bloquear cookies pelas
        configurações do navegador.
        O bloqueio de cookies
        necessários pode afetar
        determinadas funções do
        site.
      </p>

      <h2>
        6. Privacidade
      </h2>

      <p>
        Para saber mais sobre como
        dados pessoais podem ser
        tratados pelo portal,
        consulte a{' '}
        <Link href="/politica-de-privacidade">
          Política de Privacidade
        </Link>
        .
      </p>

      <h2>
        7. Alterações e contato
      </h2>

      <p>
        Esta política poderá ser
        atualizada para refletir
        alterações técnicas,
        regulatórias ou nos
        serviços utilizados pelo
        portal.
      </p>

      <p>
        Dúvidas relacionadas à
        privacidade e cookies podem
        ser encaminhadas pelos
        canais oficiais da Biosfera.
      </p>

      <p>
        <Link
          className="button"
          href="/contato"
        >
          Entrar em contato
        </Link>
      </p>
    </article>
  );
}