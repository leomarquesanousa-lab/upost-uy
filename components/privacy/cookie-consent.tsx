'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
} from 'react';

const COOKIE_NAME =
  'biosfera_cookie_consent';

const COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

type ConsentState = {
  analytics: boolean;
  advertising: boolean;
};

const defaultConsent: ConsentState = {
  analytics: false,
  advertising: false,
};

function readConsent():
  | ConsentState
  | null {
  if (
    typeof document ===
    'undefined'
  ) {
    return null;
  }

  const entry =
    document.cookie
      .split('; ')
      .find(item =>
        item.startsWith(
          `${COOKIE_NAME}=`,
        ),
      );

  if (!entry) {
    return null;
  }

  try {
    const raw =
      decodeURIComponent(
        entry.substring(
          COOKIE_NAME.length + 1,
        ),
      );

    const parsed =
      JSON.parse(raw);

    return {
      analytics:
        parsed.analytics === true,
      advertising:
        parsed.advertising === true,
    };
  } catch {
    return null;
  }
}

function saveConsent(
  consent: ConsentState,
) {
  const value =
    encodeURIComponent(
      JSON.stringify(consent),
    );

  document.cookie =
    `${COOKIE_NAME}=${value}; ` +
    `Max-Age=${COOKIE_MAX_AGE}; ` +
    `Path=/; ` +
    `SameSite=Lax`;

  window.dispatchEvent(
    new CustomEvent(
      'biosfera:cookie-consent-changed',
      {
        detail: consent,
      },
    ),
  );
}

function CookieIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        d="
          M39.5 26.2
          C36.8 26.7 34 25.9 32 23.9
          C30 21.9 29.2 19.1 29.7 16.4
          C26.2 15.6 23.6 12.7 23.2 9.2
          C14.7 9.6 8 16.6 8 25.2
          C8 34.1 15.2 41.3 24.1 41.3
          C32.7 41.3 39.8 34.6 40.2 26.1
          C40 26.1 39.8 26.2 39.5 26.2
          Z
        "
        fill="currentColor"
      />

      <circle
        cx="18"
        cy="21"
        r="2.3"
        fill="#06244b"
      />

      <circle
        cx="26"
        cy="31"
        r="2.3"
        fill="#06244b"
      />

      <circle
        cx="16"
        cy="31"
        r="1.8"
        fill="#06244b"
      />
    </svg>
  );
}

export function CookieConsent() {
  const [
    visible,
    setVisible,
  ] = useState(false);

  const [
    customizing,
    setCustomizing,
  ] = useState(false);

  const [
    consent,
    setConsent,
  ] =
    useState<ConsentState>(
      defaultConsent,
    );

  useEffect(() => {
    const existing =
      readConsent();

    // Hydrate browser-only cookie state after SSR; keep the initial render unchanged.
    if (!existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize with document.cookie on mount.
      setVisible(true);
    } else {
      setConsent(existing);
    }

    function openPreferences() {
      const current =
        readConsent();

      setConsent(
        current ??
          defaultConsent,
      );

      setCustomizing(true);
      setVisible(true);
    }

    window.addEventListener(
      'biosfera:open-cookie-preferences',
      openPreferences,
    );

    return () => {
      window.removeEventListener(
        'biosfera:open-cookie-preferences',
        openPreferences,
      );
    };
  }, []);

  function acceptAll() {
    const next = {
      analytics: true,
      advertising: true,
    };

    saveConsent(next);
    setConsent(next);
    setVisible(false);
    setCustomizing(false);
  }

  function rejectOptional() {
    const next = {
      analytics: false,
      advertising: false,
    };

    saveConsent(next);
    setConsent(next);
    setVisible(false);
    setCustomizing(false);
  }

  function savePreferences() {
    saveConsent(consent);
    setVisible(false);
    setCustomizing(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="cookie-layer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
    >
      <section
        className={
          customizing
            ? 'cookie-card is-customizing'
            : 'cookie-card'
        }
      >
        <div className="cookie-accent" />

        <div className="cookie-header">
          <div className="cookie-icon">
            <CookieIcon />
          </div>

          <div className="cookie-heading">
            <span className="cookie-eyebrow">
              PRIVACIDADE
            </span>

            <h2 id="cookie-title">
              {customizing
                ? 'Escolha como navegar'
                : 'Cookies, do seu jeito.'}
            </h2>
          </div>
        </div>

        {!customizing ? (
          <>
            <p className="cookie-description">
              Usamos cookies essenciais
              para o portal funcionar.
              Você decide se permite
              análise e publicidade.
            </p>

            <div className="cookie-links">
              <Link href="/politica-de-cookies">
                Política de Cookies
              </Link>

              <span>•</span>

              <Link href="/politica-de-privacidade">
                Privacidade
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="cookie-description">
              Os essenciais ficam
              sempre ativos. Os demais
              ficam por sua escolha.
            </p>

            <div className="cookie-options">
              <div className="cookie-option">
                <div className="option-copy">
                  <strong>
                    Essenciais
                  </strong>

                  <span>
                    Segurança e
                    funcionamento.
                  </span>
                </div>

                <span className="always-on">
                  Sempre ativo
                </span>
              </div>

              <label className="cookie-option">
                <div className="option-copy">
                  <strong>
                    Análise
                  </strong>

                  <span>
                    Ajuda a entender o
                    uso do portal.
                  </span>
                </div>

                <input
                  className="cookie-switch"
                  type="checkbox"
                  checked={
                    consent.analytics
                  }
                  onChange={event =>
                    setConsent(
                      current => ({
                        ...current,
                        analytics:
                          event.target
                            .checked,
                      }),
                    )
                  }
                  aria-label="Permitir cookies de análise"
                />
              </label>

              <label className="cookie-option">
                <div className="option-copy">
                  <strong>
                    Publicidade
                  </strong>

                  <span>
                    Recursos e medição
                    de anúncios.
                  </span>
                </div>

                <input
                  className="cookie-switch"
                  type="checkbox"
                  checked={
                    consent.advertising
                  }
                  onChange={event =>
                    setConsent(
                      current => ({
                        ...current,
                        advertising:
                          event.target
                            .checked,
                      }),
                    )
                  }
                  aria-label="Permitir cookies de publicidade"
                />
              </label>
            </div>
          </>
        )}

        <div className="cookie-actions">
          {!customizing ? (
            <>
              <button
                type="button"
                className="cookie-button ghost"
                onClick={
                  rejectOptional
                }
              >
                Recusar
              </button>

              <button
                type="button"
                className="cookie-button ghost"
                onClick={() =>
                  setCustomizing(true)
                }
              >
                Personalizar
              </button>

              <button
                type="button"
                className="cookie-button primary"
                onClick={acceptAll}
              >
                Aceitar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cookie-button ghost"
                onClick={
                  rejectOptional
                }
              >
                Só essenciais
              </button>

              <button
                type="button"
                className="cookie-button primary"
                onClick={
                  savePreferences
                }
              >
                Salvar escolhas
              </button>
            </>
          )}
        </div>

        {customizing ? (
          <button
            type="button"
            className="cookie-back"
            onClick={() =>
              setCustomizing(false)
            }
          >
            ← Voltar
          </button>
        ) : null}
      </section>

      <style jsx>{`
        .cookie-layer {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 10000;
          width: min(
            410px,
            calc(100vw - 28px)
          );
          pointer-events: none;
        }

        .cookie-card {
          position: relative;
          overflow: hidden;
          width: 100%;
          padding: 18px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.16
            );
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(
                6,
                36,
                75,
                0.97
              ),
              rgba(
                3,
                25,
                54,
                0.98
              )
            );
          color: #ffffff;
          box-shadow:
            0 24px 60px
              rgba(
                1,
                14,
                32,
                0.3
              ),
            0 4px 16px
              rgba(
                1,
                14,
                32,
                0.18
              );
          backdrop-filter:
            blur(18px);
          -webkit-backdrop-filter:
            blur(18px);
          pointer-events: auto;
          animation:
            cookie-enter
            0.4s
            cubic-bezier(
              0.2,
              0.8,
              0.2,
              1
            );
        }

        .cookie-card.is-customizing {
          width: min(
            470px,
            calc(100vw - 28px)
          );
        }

        .cookie-accent {
          position: absolute;
          top: 0;
          left: 20px;
          right: 20px;
          height: 2px;
          border-radius: 0 0 999px 999px;
          background:
            linear-gradient(
              90deg,
              transparent,
              #38d4f5,
              #7cecff,
              transparent
            );
          opacity: 0.9;
        }

        .cookie-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cookie-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border: 1px solid
            rgba(
              56,
              212,
              245,
              0.24
            );
          border-radius: 14px;
          background:
            rgba(
              56,
              212,
              245,
              0.1
            );
          color: #38d4f5;
        }

        .cookie-icon :global(svg) {
          width: 26px;
          height: 26px;
        }

        .cookie-heading {
          min-width: 0;
        }

        .cookie-eyebrow {
          display: block;
          margin-bottom: 2px;
          color: #65e2fb;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        h2 {
          margin: 0;
          color: #ffffff;
          font-size: 19px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .cookie-description {
          margin: 13px 0 0;
          color:
            rgba(
              255,
              255,
              255,
              0.76
            );
          font-size: 13px;
          line-height: 1.55;
        }

        .cookie-links {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
          color:
            rgba(
              255,
              255,
              255,
              0.34
            );
          font-size: 11px;
        }

        .cookie-links
          :global(a) {
          color:
            rgba(
              255,
              255,
              255,
              0.68
            );
          font-weight: 700;
          text-decoration: none;
          transition:
            color 0.2s ease;
        }

        .cookie-links
          :global(a:hover) {
          color: #65e2fb;
        }

        .cookie-options {
          display: grid;
          gap: 7px;
          margin-top: 14px;
        }

        .cookie-option {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 14px;
          padding: 10px 11px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
          border-radius: 13px;
          background:
            rgba(
              255,
              255,
              255,
              0.045
            );
        }

        .option-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .option-copy strong {
          color: #ffffff;
          font-size: 13px;
          line-height: 1.25;
        }

        .option-copy span {
          color:
            rgba(
              255,
              255,
              255,
              0.58
            );
          font-size: 11px;
          line-height: 1.35;
        }

        .always-on {
          flex: 0 0 auto;
          padding: 5px 8px;
          border-radius: 999px;
          background:
            rgba(
              56,
              212,
              245,
              0.1
            );
          color: #65e2fb;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .cookie-switch {
          position: relative;
          width: 38px;
          height: 22px;
          flex: 0 0 38px;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.18
            );
          border-radius: 999px;
          background:
            rgba(
              255,
              255,
              255,
              0.1
            );
          cursor: pointer;
          transition:
            background 0.2s ease,
            border-color 0.2s ease;
        }

        .cookie-switch::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow:
            0 2px 6px
              rgba(
                0,
                0,
                0,
                0.25
              );
          transition:
            transform 0.2s ease;
        }

        .cookie-switch:checked {
          border-color: #38d4f5;
          background: #38d4f5;
        }

        .cookie-switch:checked::after {
          transform:
            translateX(16px);
          background: #06244b;
        }

        .cookie-actions {
          display: flex;
          justify-content:
            flex-end;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 15px;
        }

        .cookie-button {
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 11px;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            background 0.18s ease,
            border-color 0.18s ease;
        }

        .cookie-button:hover {
          transform:
            translateY(-1px);
        }

        .cookie-button.primary {
          border: 1px solid
            #38d4f5;
          background:
            linear-gradient(
              135deg,
              #38d4f5,
              #67e4fc
            );
          color: #052344;
          box-shadow:
            0 7px 20px
              rgba(
                56,
                212,
                245,
                0.16
              );
        }

        .cookie-button.ghost {
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.13
            );
          background:
            rgba(
              255,
              255,
              255,
              0.045
            );
          color:
            rgba(
              255,
              255,
              255,
              0.78
            );
        }

        .cookie-button.ghost:hover {
          border-color:
            rgba(
              255,
              255,
              255,
              0.25
            );
          background:
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        .cookie-back {
          display: block;
          margin: 11px 0 -2px;
          padding: 0;
          border: 0;
          background: transparent;
          color:
            rgba(
              255,
              255,
              255,
              0.5
            );
          font: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .cookie-back:hover {
          color: #65e2fb;
        }

        @keyframes cookie-enter {
          from {
            opacity: 0;
            transform:
              translateY(18px)
              scale(0.97);
          }

          to {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }
        }

        @media (
          max-width: 640px
        ) {
          .cookie-layer {
            right: 12px;
            bottom: 12px;
            left: 12px;
            width: auto;
          }

          .cookie-card,
          .cookie-card.is-customizing {
            width: 100%;
            padding: 15px;
            border-radius: 18px;
          }

          .cookie-icon {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
            border-radius: 12px;
          }

          .cookie-icon
            :global(svg) {
            width: 23px;
            height: 23px;
          }

          h2 {
            font-size: 17px;
          }

          .cookie-description {
            margin-top: 11px;
            font-size: 12px;
          }

          .cookie-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .cookie-actions
            .primary:last-child {
            grid-column:
              1 / -1;
          }

          .is-customizing
            .cookie-actions {
            grid-template-columns:
              1fr 1fr;
          }

          .is-customizing
            .cookie-actions
            .primary:last-child {
            grid-column: auto;
          }

          .cookie-button {
            width: 100%;
          }
        }

        @media (
          prefers-reduced-motion:
            reduce
        ) {
          .cookie-card {
            animation: none;
          }

          .cookie-button,
          .cookie-switch,
          .cookie-switch::after {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

export function CookiePreferencesButton() {
  function openPreferences() {
    window.dispatchEvent(
      new Event(
        'biosfera:open-cookie-preferences',
      ),
    );
  }

  return (
    <button
      type="button"
      onClick={
        openPreferences
      }
      style={{
        padding: 0,
        border: 0,
        background:
          'transparent',
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      Preferências de cookies
    </button>
  );
}