'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';

import { persistToast } from '../../../components/ui/flash-toast';
import { ApiError } from '../../../lib/api-client';
import {
  createSession,
  createSessionFromTokens,
  getCurrentUser,
  logout,
  refreshSession as refreshTokens,
} from '../lib/auth-api';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../lib/auth-storage';
import { isAuthSessionSyncSuppressed } from '../lib/auth-sync-guard';
import { getMillisecondsUntilTokenExpiry, isTokenExpired } from '../lib/auth-token';
import type { AuthSession, AuthTokens, LoginInput } from '../types/auth-session';

const SESSION_REFRESH_INTERVAL_MS = 30_000;
const SESSION_EXPIRY_BUFFER_MS = 15_000;

type AuthContextValue = {
  authSession: AuthSession | null;
  isHydrated: boolean;
  isSigningIn: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  establishSession: (tokens: AuthTokens) => Promise<void>;
  signOut: () => void;
  refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function AuthProvider({ children }: AuthProviderProps) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const hasHandledSessionExpiryRef = useRef(false);

  const applySession = useCallback((session: AuthSession | null) => {
    if (!session) {
      clearStoredSession();
      setAuthSession(null);
      return;
    }

    hasHandledSessionExpiryRef.current = false;
    writeStoredSession(session);
    setAuthSession(session);
  }, []);

  const closeExpiredSession = useCallback(() => {
    if (hasHandledSessionExpiryRef.current) {
      clearStoredSession();
      setAuthSession(null);
      return;
    }

    hasHandledSessionExpiryRef.current = true;
    clearStoredSession();
    setAuthSession(null);
    persistToast({
      title: 'Sesion finalizada',
      description: 'Tu sesion expiro. Ingresa nuevamente para continuar.',
      tone: 'info',
    });
  }, []);

  const refreshSessionTokens = useCallback(async (refreshToken: string): Promise<AuthSession | null> => {
    try {
      const refreshedTokens = await refreshTokens(refreshToken);
      const user = await getCurrentUser(refreshedTokens.accessToken);

      return {
        accessToken: refreshedTokens.accessToken,
        refreshToken: refreshedTokens.refreshToken,
        user,
      } satisfies AuthSession;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const storedSession = readStoredSession();

      if (!storedSession) {
        if (isMounted) {
          setAuthSession(null);
          setIsHydrated(true);
        }

        return;
      }

      try {
        if (isTokenExpired(storedSession.accessToken) && storedSession.refreshToken) {
          const refreshedSession = await refreshSessionTokens(storedSession.refreshToken);

          if (refreshedSession) {
            if (isMounted) {
              applySession(refreshedSession);
            }
          } else if (isMounted) {
            closeExpiredSession();
          }

          return;
        }

        const user = await getCurrentUser(storedSession.accessToken);
        const nextSession = {
          accessToken: storedSession.accessToken,
          refreshToken: storedSession.refreshToken,
          user,
        } satisfies AuthSession;

        writeStoredSession(nextSession);

        if (isMounted) {
          setAuthSession(nextSession);
        }
      } catch (error) {
        if (
          storedSession.refreshToken &&
          error instanceof ApiError &&
          error.status === 401
        ) {
          const refreshedSession = await refreshSessionTokens(storedSession.refreshToken);

          if (refreshedSession) {
            if (isMounted) {
              applySession(refreshedSession);
            }

            return;
          }
        }

        clearStoredSession();

        if (isMounted) {
          closeExpiredSession();
        }
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [applySession, refreshSessionTokens]);

  useEffect(() => {
    if (!authSession || typeof window === 'undefined') {
      return;
    }

    let isActive = true;

    const syncSession = async () => {
      if (isAuthSessionSyncSuppressed()) {
        return;
      }

      if (isTokenExpired(authSession.accessToken)) {
        const refreshedSession = await refreshSessionTokens(authSession.refreshToken);

        if (!isActive) {
          return;
        }

        if (refreshedSession) {
          applySession(refreshedSession);
        } else {
          closeExpiredSession();
        }

        return;
      }

      try {
        const user = await getCurrentUser(authSession.accessToken);

        if (!isActive) {
          return;
        }

        const nextSession = {
          accessToken: authSession.accessToken,
          refreshToken: authSession.refreshToken,
          user,
        } satisfies AuthSession;

        writeStoredSession(nextSession);
        setAuthSession((currentSession) =>
          areAuthSessionsEqual(currentSession, nextSession) ? currentSession : nextSession,
        );
      } catch (error) {
        if (!isActive || !(error instanceof ApiError) || error.status !== 401) {
          return;
        }

        const refreshedSession = await refreshSessionTokens(authSession.refreshToken);

        if (!isActive) {
          return;
        }

        if (refreshedSession) {
          applySession(refreshedSession);
        } else {
          closeExpiredSession();
        }
      }
    };

    const handleFocus = () => {
      void syncSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncSession();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncSession();
    }, SESSION_REFRESH_INTERVAL_MS);

    const millisecondsUntilExpiry = getMillisecondsUntilTokenExpiry(authSession.accessToken);
    const timeoutDelay =
      millisecondsUntilExpiry === null
        ? null
        : Math.max(millisecondsUntilExpiry - SESSION_EXPIRY_BUFFER_MS, 0);
    const expiryTimeoutId =
      timeoutDelay === null
        ? null
        : window.setTimeout(() => {
            void syncSession();
          }, timeoutDelay);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);

      if (expiryTimeoutId !== null) {
        window.clearTimeout(expiryTimeoutId);
      }

      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applySession, authSession, closeExpiredSession, refreshSessionTokens]);

  const signIn = async (input: LoginInput): Promise<void> => {
    setIsSigningIn(true);

    try {
      const session = await createSession(input);
      applySession(session);
    } finally {
      setIsSigningIn(false);
      setIsHydrated(true);
    }
  };

  const signOut = useCallback((): void => {
    if (authSession?.refreshToken) {
      void (async () => {
        try {
          await logout(authSession.refreshToken);
        } catch {
          return undefined;
        }
      })();
    }

    hasHandledSessionExpiryRef.current = false;
    clearStoredSession();
    setAuthSession(null);
  }, [authSession?.refreshToken]);

  const establishSession = async (tokens: AuthTokens): Promise<void> => {
    const session = await createSessionFromTokens(tokens);
    applySession(session);
    setIsHydrated(true);
  };

  const refreshSession = async (): Promise<void> => {
    if (!authSession) {
      return;
    }

    if (isTokenExpired(authSession.accessToken)) {
      const refreshedSession = await refreshSessionTokens(authSession.refreshToken);

      if (refreshedSession) {
        applySession(refreshedSession);
      } else {
        closeExpiredSession();
      }

      return;
    }

    const user = await getCurrentUser(authSession.accessToken);
    const nextSession = {
      accessToken: authSession.accessToken,
      refreshToken: authSession.refreshToken,
      user,
    } satisfies AuthSession;

    applySession(nextSession);
  };

  return (
    <AuthContext.Provider
      value={{
        authSession,
        isHydrated,
        isSigningIn,
        signIn,
        establishSession,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function areAuthSessionsEqual(
  currentSession: AuthSession | null,
  nextSession: AuthSession,
): boolean {
  if (!currentSession) {
    return false;
  }

  return (
    currentSession.accessToken === nextSession.accessToken &&
    currentSession.refreshToken === nextSession.refreshToken &&
    JSON.stringify(currentSession.user) === JSON.stringify(nextSession.user)
  );
}
