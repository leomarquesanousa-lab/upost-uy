'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

type Message = {
  id: string;
  display_name: string;
  message: string;
  sender_type: string;
  status: string;
  visitor_id?: string;
  blocked?: boolean;
};

type State = {
  enabled: boolean;
  visitor: {
    name: string;
    blocked: boolean;
  } | null;
  messages: Message[];
};

export function Chat({ admin = false }: { admin?: boolean }) {
  const attachmentHelp = useId();

  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [before, setBefore] = useState('');

  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const params = admin
        ? `?admin=1${before ? `&before=${encodeURIComponent(before)}` : ''}`
        : '';

      const response = await fetch(`/api/chat${params}`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || 'Não foi possível carregar o chat.',
        );
      }

      if (
        typeof result?.enabled !== 'boolean' ||
        !Array.isArray(result?.messages)
      ) {
        throw new Error('Resposta inválida do chat.');
      }

      setData(result);
      setError('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('O chat demorou para responder. Tentando novamente…');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Chat temporariamente indisponível.',
        );
      }
    } finally {
      window.clearTimeout(timeout);
      loadingRef.current = false;
    }
  }, [admin, before]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(initial = false) {
      if (stopped) {
        return;
      }

      if (initial || !document.hidden) {
        await refresh();
      }

      if (!stopped) {
        timer = setTimeout(() => {
          void poll(false);
        }, 5000);
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        void refresh();
      }
    }

    // A primeira carga é sempre executada.
    void poll(true);

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    return () => {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
      }

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
    };
  }, [refresh]);

  async function action(
    intent: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent,
          ...extra,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || 'Não foi possível concluir a ação.',
        );
      }

      await refresh();

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Chat temporariamente indisponível.',
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={admin ? 'chat-admin' : 'chat-panel'}
      aria-label="Chat ao vivo"
    >
      <div className="panel-heading">
        <h2>Chat ao vivo</h2>

        <span className="eyebrow">
          {admin ? 'MODERAÇÃO' : 'PARTICIPE'}
        </span>
      </div>

      {admin && data && (
        <div className="phase-buttons">
          <button
            disabled={busy}
            onClick={() =>
              action(data.enabled ? 'disable' : 'enable')
            }
          >
            {data.enabled ? 'Desativar chat' : 'Ativar chat'}
          </button>

          <button onClick={() => setBefore('')}>
            Mensagens recentes
          </button>

          {data.messages.length > 0 && (
            <button
              onClick={() =>
                setBefore(data.messages[0].id)
              }
            >
              Mensagens anteriores
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert">
          {error}
        </p>
      )}

      {!data && !error && (
        <p>Carregando conversa…</p>
      )}

      {data && !data.enabled && !admin && (
        <p>Chat temporariamente indisponível.</p>
      )}

      {data && (data.enabled || admin) && (
        <>
          <ol
            className="chat-messages"
            aria-label="Mensagens recentes"
            aria-live="polite"
          >
            {data.messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.sender_type === 'STAFF'
                    ? 'staff-message'
                    : ''
                }
              >
                <strong>
                  {message.display_name}
                </strong>

                <small className="chat-sender-label">
                  {message.sender_type === 'STAFF'
                    ? ' · EQUIPE'
                    : ' · OUVINTE'}
                </small>

                <p>
                  {message.message}
                </p>

                {admin && (
                  <>
                    <small>
                      {message.status}
                    </small>

                    <div className="phase-buttons">
                      {message.status !== 'DELETED' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(
                                message.status === 'HIDDEN'
                                  ? 'show'
                                  : 'hide',
                                { id: message.id },
                              )
                            }
                          >
                            {message.status === 'HIDDEN'
                              ? 'Exibir'
                              : 'Ocultar'}
                          </button>

                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  'Excluir logicamente esta mensagem?',
                                )
                              ) {
                                void action('delete', {
                                  id: message.id,
                                });
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </>
                      )}

                      {message.visitor_id && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            action(
                              message.blocked
                                ? 'unblock'
                                : 'block',
                              {
                                id: message.visitor_id,
                              },
                            )
                          }
                        >
                          {message.blocked
                            ? 'Desbloquear'
                            : 'Bloquear sessão'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>

          {!data.messages.length && (
            <p>A conversa começa com você.</p>
          )}

          {data.enabled &&
          (admin || data.visitor) ? (
            data.visitor?.blocked && !admin ? (
              <p>
                Esta sessão está bloqueada para envio.
              </p>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();

                  const form = event.currentTarget;
                  const message = String(
                    new FormData(form).get('message') || '',
                  );

                  if (
                    await action(
                      admin ? 'reply' : 'send',
                      { message },
                    )
                  ) {
                    form.reset();
                  }
                }}
              >
                <label>
                  {admin
                    ? 'Resposta da Biosfera'
                    : 'Sua mensagem'}

                  <textarea
                    name="message"
                    required
                    maxLength={500}
                    placeholder="Digite sua mensagem..."
                  />
                </label>

                <div className="chat-send-actions">
                  {!admin && (
                    <div
                      className="chat-attachments"
                      role="group"
                      aria-label="Anexos indisponíveis"
                      aria-describedby={attachmentHelp}
                    >
                      <button
                        type="button"
                        disabled
                        aria-label="Enviar foto — em breve"
                      >
                        <span aria-hidden="true">
                          ▧
                        </span>{' '}
                        Foto
                      </button>

                      <button
                        type="button"
                        disabled
                        aria-label="Enviar vídeo — em breve"
                      >
                        <span aria-hidden="true">
                          ▷
                        </span>{' '}
                        Vídeo
                      </button>
                    </div>
                  )}

                  <button
                    className="button"
                    disabled={busy}
                  >
                    Enviar
                  </button>
                </div>

                {!admin && (
                  <small
                    id={attachmentHelp}
                    className="chat-attachment-note"
                  >
                    Fotos e vídeos em breve. Por enquanto,
                    participe por texto.
                  </small>
                )}
              </form>
            )
          ) : (
            data.enabled && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();

                  const form = event.currentTarget;
                  const name = new FormData(form).get(
                    'name',
                  );

                  await action('join', { name });
                }}
              >
                <label>
                  Seu nome

                  <input
                    name="name"
                    required
                    maxLength={40}
                    autoComplete="nickname"
                  />
                </label>

                <button
                  className="button"
                  disabled={busy}
                >
                  Entrar no chat
                </button>
              </form>
            )
          )}
        </>
      )}
    </section>
  );
}