const AUTH_SYNC_SUPPRESSION_WINDOW_KEY = '__saferidepro_auth_sync_suppressed_until__';

type GlobalWindowWithAuthSyncGuard = Window & {
  [AUTH_SYNC_SUPPRESSION_WINDOW_KEY]?: number;
};

export function suppressAuthSessionSync(milliseconds = 5_000): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextSuppressedUntil = Date.now() + milliseconds;
  const typedWindow = window as GlobalWindowWithAuthSyncGuard;
  const currentSuppressedUntil = typedWindow[AUTH_SYNC_SUPPRESSION_WINDOW_KEY] ?? 0;

  typedWindow[AUTH_SYNC_SUPPRESSION_WINDOW_KEY] = Math.max(
    currentSuppressedUntil,
    nextSuppressedUntil,
  );
}

export function isAuthSessionSyncSuppressed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const typedWindow = window as GlobalWindowWithAuthSyncGuard;
  const suppressedUntil = typedWindow[AUTH_SYNC_SUPPRESSION_WINDOW_KEY] ?? 0;

  return suppressedUntil > Date.now();
}
