'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

import { Brand } from '@/components/brand';
import { HeaderListen } from '@/components/radio/radio-player';

const menu = [
  ['/', 'Início'],
  ['/noticias', 'Notícias'],
  ['/radio', 'Rádio'],
  ['/programacao', 'Programação'],
  ['/videos', 'Vídeos'],
  ['/contato', 'Contato'],
];

const socialLinks = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/biortv.oficial/',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 22v-8h2.7l.5-3h-3.2V9.1c0-.9.3-1.6 1.6-1.6H17V4.8c-.3 0-1.3-.1-2.5-.1-2.4 0-4 1.4-4 4.2V11H8v3h2.5v8h3Z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/ritvit26',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm0 1.8A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm9.45 1.35a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" />
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com/biortv72344',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.9 3H21l-6.55 7.49L22 21h-5.95l-4.66-6.1L6.06 21H4l7-8L2 3h6.1l4.21 5.53L18.9 3Zm-1.04 16.2h1.16L7.46 4.74H6.2L17.86 19.2Z" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@MultbioRTV',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.6 7.2a2.97 2.97 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6a2.97 2.97 0 0 0-2.1 2.1c-.6 1.8-.6 4.8-.6 4.8s0 3 .6 4.8a2.97 2.97 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a2.97 2.97 0 0 0 2.1-2.1c.6-1.8.6-4.8.6-4.8s0-3-.6-4.8ZM10 15.6V8.4l6 3.6-6 3.6Z" />
      </svg>
    ),
  },
];

export function PublicHeader({
  siteName,
}: {
  siteName: string;
}) {
  const [open, setOpen] =
    useState(false);

  const pathname =
    usePathname();

  return (
    <>
      <header className="portal-header">
        <div className="site-header container">
          <Link
            className="header-brand"
            href="/"
            aria-label={`${siteName} — início`}
            onClick={() =>
              setOpen(false)
            }
          >
            <Brand light />
          </Link>

          <nav
            id="portal-navigation"
            className={`main-nav ${
              open
                ? 'is-open'
                : ''
            }`}
            aria-label="Navegação principal"
          >
            <div>
              {menu.map(
                ([href, label]) => (
                  <Link
                    href={href}
                    key={href}
                    aria-current={
                      pathname === href
                        ? 'page'
                        : undefined
                    }
                    onClick={() =>
                      setOpen(false)
                    }
                  >
                    {label}
                  </Link>
                ),
              )}

              <Link
                href="/busca"
                className="search-link"
                aria-label="Buscar no portal"
                onClick={() =>
                  setOpen(false)
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="6"
                  />

                  <path d="m15 15 5 5" />
                </svg>

                <span>
                  Buscar
                </span>
              </Link>
            </div>
          </nav>

          <div className="header-actions">
            <HeaderListen />

            <Link
              href="/admin"
              className="restricted-area-link"
              aria-label="Área restrita"
            >
              <span
                aria-hidden="true"
              >
                🔒
              </span>

              <span className="restricted-area-label">
                Área restrita
              </span>
            </Link>

            <button
              className="menu-toggle"
              aria-label={
                open
                  ? 'Fechar menu'
                  : 'Abrir menu'
              }
              aria-expanded={
                open
              }
              aria-controls="portal-navigation"
              onClick={() =>
                setOpen(
                  !open,
                )
              }
            >
              <span
                aria-hidden="true"
              >
                {open
                  ? '×'
                  : '☰'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <aside
        className="biosfera-social-rail"
        aria-label="Redes sociais"
      >
        {socialLinks.map(
          social => (
            <Link
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.name}
              title={social.name}
              className="biosfera-social-link"
            >
              {social.icon}
            </Link>
          ),
        )}
      </aside>

      <style jsx>{`
        .biosfera-social-rail {
          position: fixed;
          top: 50%;
          right: 18px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 9px;
          transform: translateY(-50%);
        }

        .biosfera-social-rail
          :global(.biosfera-social-link) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          padding: 0;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 50%;
          background: #08284f;
          color: #ffffff;
          box-shadow:
            0 5px 18px
            rgba(0, 24, 58, 0.18);
          text-decoration: none;
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease;
        }

        .biosfera-social-rail
          :global(.biosfera-social-link:hover) {
          transform: translateX(-4px);
          background: #28c8e8;
          border-color: #28c8e8;
          color: #06244b;
        }

        .biosfera-social-rail
          :global(.biosfera-social-link svg) {
          display: block;
          width: 19px;
          height: 19px;
          fill: currentColor;
        }

        @media (
          max-width: 1100px
        ) {
          .biosfera-social-rail {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
