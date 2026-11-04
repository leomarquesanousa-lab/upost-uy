import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Biosfera Rádio TV Web',
  description:
    'Política de Privacidade do Portal Biosfera Rádio TV Web.',
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
        INSTITUCIONAL
      </p>

      <h1>
        Política de Privacidade
      </h1>

      <p>
        Última atualização:
        1º de outubro de 2026.
      </p>

      <p>
        A Biosfera Rádio TV Web
        respeita a privacidade de
        seus visitantes e busca
        tratar dados pessoais com
        transparência, segurança e
        responsabilidade.
      </p>

      <p>
        Esta Política de Privacidade
        explica quais informações
        podem ser coletadas durante
        a utilização do portal,
        como elas podem ser
        utilizadas e quais opções
        estão disponíveis aos
        usuários.
      </p>

      <h2>
        1. Responsável pelo portal
      </h2>

      <p>
        O Portal Biosfera Rádio TV
        Web é responsável pelas
        atividades de tratamento de
        dados realizadas diretamente
        por meio deste site.
      </p>

      <p>
        Informações cadastrais ou
        empresariais adicionais
        poderão ser incluídas nesta
        política quando forem
        formalmente disponibilizadas
        pela organização responsável
        pelo portal.
      </p>

      <h2>
        2. Informações que podem ser coletadas
      </h2>

      <p>
        Dependendo da forma como o
        usuário utiliza o portal,
        poderão ser coletadas ou
        processadas informações como:
      </p>

      <ul>
        <li>
          nome e informações enviadas
          voluntariamente por
          formulários;
        </li>

        <li>
          mensagens enviadas pelos
          canais de contato;
        </li>

        <li>
          informações fornecidas em
          recursos de participação,
          quando disponíveis;
        </li>

        <li>
          endereço IP;
        </li>

        <li>
          informações técnicas do
          navegador e dispositivo;
        </li>

        <li>
          páginas acessadas e dados
          relacionados à navegação;
        </li>

        <li>
          preferências de cookies;
        </li>

        <li>
          dados estatísticos de uso
          do portal.
        </li>
      </ul>

      <h2>
        3. Finalidades do tratamento
      </h2>

      <p>
        As informações podem ser
        utilizadas para:
      </p>

      <ul>
        <li>
          disponibilizar e manter o
          funcionamento do portal;
        </li>

        <li>
          responder contatos e
          solicitações;
        </li>

        <li>
          melhorar a experiência de
          navegação;
        </li>

        <li>
          entender o desempenho e a
          audiência do portal;
        </li>

        <li>
          melhorar conteúdos e
          serviços;
        </li>

        <li>
          proteger a plataforma
          contra fraude, abuso ou
          acesso indevido;
        </li>

        <li>
          cumprir obrigações legais
          ou regulatórias.
        </li>
      </ul>

      <h2>
        4. Cookies
      </h2>

      <p>
        O portal pode utilizar
        cookies e tecnologias
        semelhantes para permitir
        seu funcionamento, armazenar
        preferências e compreender
        como os visitantes utilizam
        o site.
      </p>

      <p>
        Mais informações estão
        disponíveis na{' '}
        <Link href="/politica-de-cookies">
          Política de Cookies
        </Link>
        .
      </p>

      <h2>
        5. Serviços de terceiros
      </h2>

      <p>
        O portal pode utilizar
        serviços externos para
        hospedagem, métricas,
        publicidade, reprodução de
        áudio, vídeo, streaming ou
        outros recursos necessários
        ao funcionamento da
        plataforma.
      </p>

      <p>
        Esses serviços podem realizar
        tratamentos de dados de
        acordo com suas próprias
        políticas de privacidade.
      </p>

      <h2>
        6. Compartilhamento de dados
      </h2>

      <p>
        A Biosfera não comercializa
        dados pessoais como produto.
      </p>

      <p>
        Informações poderão ser
        compartilhadas com
        prestadores de serviços
        necessários ao funcionamento
        do portal ou quando houver
        obrigação legal.
      </p>

      <h2>
        7. Segurança
      </h2>

      <p>
        São adotadas medidas técnicas
        e administrativas razoáveis
        para proteger informações
        contra acessos não
        autorizados, perda,
        alteração, destruição ou
        divulgação indevida.
      </p>

      <h2>
        8. Retenção de informações
      </h2>

      <p>
        As informações serão mantidas
        pelo período necessário para
        atender às finalidades para
        as quais foram coletadas,
        cumprir obrigações legais,
        garantir segurança ou
        exercer direitos.
      </p>

      <h2>
        9. Direitos do usuário
      </h2>

      <p>
        Nos termos da legislação
        aplicável, o titular de dados
        pessoais poderá solicitar
        informações sobre o
        tratamento de seus dados e
        exercer os direitos previstos
        em lei.
      </p>

      <p>
        Entre eles podem estar,
        conforme aplicável:
      </p>

      <ul>
        <li>
          confirmação da existência
          de tratamento;
        </li>

        <li>
          acesso aos dados;
        </li>

        <li>
          correção de informações;
        </li>

        <li>
          exclusão de dados quando
          legalmente aplicável;
        </li>

        <li>
          revogação de consentimento;
        </li>

        <li>
          informações sobre
          compartilhamento de dados.
        </li>
      </ul>

      <h2>
        10. Contato
      </h2>

      <p>
        Solicitações ou dúvidas
        relacionadas à privacidade
        podem ser encaminhadas pelos
        canais oficiais de contato
        da Biosfera Rádio TV Web.
      </p>

      <p>
        <Link
          className="button"
          href="/contato"
        >
          Fale com a Biosfera
        </Link>
      </p>

      <h2>
        11. Alterações desta política
      </h2>

      <p>
        Esta Política de Privacidade
        poderá ser atualizada para
        refletir alterações legais,
        técnicas ou operacionais.
      </p>

      <p>
        A versão mais recente estará
        sempre disponível nesta
        página.
      </p>
    </article>
  );
}