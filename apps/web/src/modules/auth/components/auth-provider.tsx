'use client';

import { createContext, useEffect, useState } from 'react';

import { createSession, getCurrentUser } from '../lib/auth-api';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../lib/auth-storage';
import type { AuthSession, LoginInput } from '../types/auth-session';

type AuthContextValue = {
  authSession: AuthSession | null;
  isHydrated: boolean;
  isSigningIn: boolean;
  signIn: (input: LoginInput) => Promise<void>;
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
          user,
        } satisfies AuthSession;

        writeStoredSession(nextSession);

        if (isMounted) {
          setAuthSession(nextSession);
        }
      } catch {
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
    clearStoredSession();
    setAuthSession(null);
  };

  const refreshSession = async (): Promise<void> => {
    if (!authSession) {
      return;
    }

    const user = await getCurrentUser(authSession.accessToken);
    const nextSession = {
      accessToken: authSession.accessToken,
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
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


