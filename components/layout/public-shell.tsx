import Link from 'next/link';

import { AdBanner } from '@/components/ads/banner';
import { Brand } from '@/components/brand';

import {
  CookieConsent,
  CookiePreferencesButton,
} from '@/components/privacy/cookie-consent';

import { RadioWave } from '@/components/radio/radio-wave';

import {
  adPositions,
} from '@/lib/admin/policy.mjs';

import {
  brandSocialLinks,
} from '@/lib/brand';

import { PublicHeader } from './public-header';
import { WhatsAppButton } from './whatsapp-button';

export function PublicShell({
  children,
  siteName,
  whatsappNumber,
}: {
  children: React.ReactNode;
  siteName: string;
  whatsappNumber: string;
}) {
  return (
    <>
      <a
        className="skip-link"
        href="#conteudo"
      >
        Pular para conteúdo
      </a>

      <PublicHeader
        siteName={
          siteName
        }
      />

      <main
        id="conteudo"
        className="container public-main"
      >
        {children}
      </main>

      <div className="container">
        <AdBanner
          position={
            adPositions.footer
          }
        />
      </div>

      <footer className="site-footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <Link
              href="/"
              aria-label="Biosfera — voltar ao início"
            >
              <Brand light />
            </Link>

            <p>
              Som, informação e
              boas conexões.
              <br />
              A Biosfera acompanha
              o seu dia.
            </p>

            <RadioWave compact />
          </div>

          <nav
            aria-label="Explore a Biosfera"
          >
            <h2>
              Na sua sintonia
            </h2>

            <Link href="/noticias">
              Todas as notícias
            </Link>

            <Link href="/programacao">
              Grade da rádio
            </Link>

            <Link href="/programas">
              Nossos programas
            </Link>

            <Link href="/apresentadores">
              Apresentadores
            </Link>

            <Link href="/tv-ao-vivo">
              Câmera e TV ao vivo
            </Link>
          </nav>

          <nav
            aria-label="Contato e institucional"
          >
            <h2>
              Vamos conversar?
            </h2>

            <Link href="/contato">
              Fale com a Biosfera ↗
            </Link>

            <Link href="/busca">
              Encontre no portal
            </Link>

            {brandSocialLinks.map(
              social => (
                <a
                  key={
                    social.href
                  }
                  href={
                    social.href
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {
                    social.label
                  }{' '}
                  ↗
                </a>
              ),
            )}

            <Link href="/politica-de-privacidade">
              Política de Privacidade
            </Link>

            <Link href="/termos-de-uso">
              Termos de Uso
            </Link>

            <Link href="/politica-de-cookies">
              Política de Cookies
            </Link>

            <CookiePreferencesButton />

            <Link href="/admin/login">
              Área administrativa ↗
            </Link>
          </nav>

          <div className="footer-bottom">
            <p>
              ©{' '}
              {new Date().getUTCFullYear()}{' '}
              {siteName}. Todos os
              direitos reservados.
            </p>

            <span>
              RÁDIO · TV · WEB
            </span>
          </div>
        </div>
      </footer>

      <CookieConsent />
      <WhatsAppButton number={whatsappNumber} />
    </>
  );
}
