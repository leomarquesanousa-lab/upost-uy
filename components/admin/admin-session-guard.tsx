'use client';

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

const IDLE_TIMEOUT =
  15 * 60 * 1000;

const STORAGE_KEY =
  'biosfera_admin_last_activity';

type Props = {
  logoutAction:
    () => Promise<void>;
};

export function AdminSessionGuard({
  logoutAction,
}: Props) {
  const timerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const loggingOutRef =
    useRef(false);

  const logoutNow =
    useCallback(async () => {
      if (
        loggingOutRef.current
      ) {
        return;
      }

      loggingOutRef.current =
        true;

      try {
        localStorage.removeItem(
          STORAGE_KEY,
        );
      } catch {
        // Ignora indisponibilidade
        // do localStorage.
      }

      try {
        await logoutAction();
      } catch {
        window.location.href =
          '/admin/login';
      }
    }, [logoutAction]);

  const scheduleCheck =
    useCallback(function checkIdleSession() {
      if (timerRef.current) {
        clearTimeout(
          timerRef.current,
        );
      }

      let lastActivity =
        Date.now();

      try {
        const stored =
          Number(
            localStorage.getItem(
              STORAGE_KEY,
            ),
          );

        if (
          Number.isFinite(
            stored,
          ) &&
          stored > 0
        ) {
          lastActivity =
            stored;
        }
      } catch {
        // Usa o horário atual.
      }

      const remaining =
        IDLE_TIMEOUT -
        (
          Date.now() -
          lastActivity
        );

      if (remaining <= 0) {
        void logoutNow();
        return;
      }

      timerRef.current =
        setTimeout(
          () => {
            checkIdleSession();
          },
          remaining,
        );
    }, [logoutNow]);

  const registerActivity =
    useCallback(() => {
      if (
        loggingOutRef.current
      ) {
        return;
      }

      const now =
        Date.now();

      try {
        localStorage.setItem(
          STORAGE_KEY,
          String(now),
        );
      } catch {
        // O timer local continua
        // funcionando mesmo sem storage.
      }

      scheduleCheck();
    }, [scheduleCheck]);

  useEffect(() => {
    /*
     * Ao entrar no painel,
     * verifica se existe uma
     * atividade recente.
     */
    let storedActivity = 0;

    try {
      storedActivity =
        Number(
          localStorage.getItem(
            STORAGE_KEY,
          ),
        );
    } catch {
      storedActivity = 0;
    }

    if (
      !Number.isFinite(
        storedActivity,
      ) ||
      storedActivity <= 0
    ) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          String(
            Date.now(),
          ),
        );
      } catch {
        // Nada a fazer.
      }
    }

    scheduleCheck();

    const activityEvents = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ] as const;

    for (
      const eventName
      of activityEvents
    ) {
      window.addEventListener(
        eventName,
        registerActivity,
        {
          passive: true,
        },
      );
    }

    function handleVisibility() {
      if (
        document.visibilityState ===
        'visible'
      ) {
        scheduleCheck();
      }
    }

    function handleStorage(
      event: StorageEvent,
    ) {
      if (
        event.key ===
        STORAGE_KEY
      ) {
        scheduleCheck();
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility,
    );

    window.addEventListener(
      'storage',
      handleStorage,
    );

    return () => {
      if (timerRef.current) {
        clearTimeout(
          timerRef.current,
        );
      }

      for (
        const eventName
        of activityEvents
      ) {
        window.removeEventListener(
          eventName,
          registerActivity,
        );
      }

      document.removeEventListener(
        'visibilitychange',
        handleVisibility,
      );

      window.removeEventListener(
        'storage',
        handleStorage,
      );
    };
  }, [
    registerActivity,
    scheduleCheck,
  ]);

  return null;
}