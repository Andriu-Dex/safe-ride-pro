'use client';

import { createContext, useEffect, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import {
  createSession,
  createSessionFromTokens,
  getCurrentUser,
  logout,
  refreshSession as refreshTokens,
} from '../lib/auth-api';
import { isAuthSessionSyncSuppressed } from '../lib/auth-sync-guard';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../lib/auth-storage';
import type { AuthSession, AuthTokens, LoginInput } from '../types/auth-session';

const SESSION_REFRESH_INTERVAL_MS = 30_000;

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
          try {
            const refreshedTokens = await refreshTokens(storedSession.refreshToken);
            const user = await getCurrentUser(refreshedTokens.accessToken);
            const nextSession = {
              accessToken: refreshedTokens.accessToken,
              refreshToken: refreshedTokens.refreshToken,
              user,
            } satisfies AuthSession;

            writeStoredSession(nextSession);

            if (isMounted) {
              setAuthSession(nextSession);
            }

            return;
          } catch {
            // Fall through to clearing storage below.
          }
        }

        clearStoredSession();

        if (isMounted) {
          setAuthSession(null);
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
  }, []);

  useEffect(() => {
    if (!authSession || typeof window === 'undefined') {
      return;
    }

    let isActive = true;

    const syncSession = async () => {
      if (isAuthSessionSyncSuppressed()) {
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

        try {
          const refreshedTokens = await refreshTokens(authSession.refreshToken);
          const user = await getCurrentUser(refreshedTokens.accessToken);

          if (!isActive) {
            return;
          }

          const nextSession = {
            accessToken: refreshedTokens.accessToken,
            refreshToken: refreshedTokens.refreshToken,
            user,
          } satisfies AuthSession;

          writeStoredSession(nextSession);
          setAuthSession((currentSession) =>
            areAuthSessionsEqual(currentSession, nextSession) ? currentSession : nextSession,
          );
        } catch {
          if (isActive) {
            clearStoredSession();
            setAuthSession(null);
          }
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

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authSession]);

  const signIn = async (input: LoginInput): Promise<void> => {
    setIsSigningIn(true);

    try {
      const session = await createSession(input);
      writeStoredSession(session);
      setAuthSession(session);
    } finally {
      setIsSigningIn(false);
      setIsHydrated(true);
    }
  };

  const signOut = (): void => {
    if (authSession?.refreshToken) {
      void (async () => {
        try {
          await logout(authSession.refreshToken);
        } catch {
          return undefined;
        }
      })();
    }

    clearStoredSession();
    setAuthSession(null);
  };

  const establishSession = async (tokens: AuthTokens): Promise<void> => {
    const session = await createSessionFromTokens(tokens);
    writeStoredSession(session);
    setAuthSession(session);
    setIsHydrated(true);
  };

  const refreshSession = async (): Promise<void> => {
    if (!authSession) {
      return;
    }

    const user = await getCurrentUser(authSession.accessToken);
    const nextSession = {
      accessToken: authSession.accessToken,
      refreshToken: authSession.refreshToken,
      user,
    } satisfies AuthSession;

    writeStoredSession(nextSession);
    setAuthSession(nextSession);
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


