import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { suppressAuthSessionSync, isAuthSessionSyncSuppressed } from './auth-sync-guard';

describe('auth-sync-guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-ignore
    delete window['__saferidepro_auth_sync_suppressed_until__'];
  });

  it('suppresses and verifies sync status', () => {
    expect(isAuthSessionSyncSuppressed()).toBe(false);

    suppressAuthSessionSync(5000);
    expect(isAuthSessionSyncSuppressed()).toBe(true);

    vi.advanceTimersByTime(5001);
    expect(isAuthSessionSyncSuppressed()).toBe(false);
  });

  it('keeps the maximum suppression time on multiple calls', () => {
    suppressAuthSessionSync(3000);
    suppressAuthSessionSync(5000);

    vi.advanceTimersByTime(4000);
    expect(isAuthSessionSyncSuppressed()).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(isAuthSessionSyncSuppressed()).toBe(false);
  });

  it('handles window undefined environment gracefully', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete globalThis.window;

    try {
      expect(() => suppressAuthSessionSync(5000)).not.toThrow();
      expect(isAuthSessionSyncSuppressed()).toBe(false);
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
