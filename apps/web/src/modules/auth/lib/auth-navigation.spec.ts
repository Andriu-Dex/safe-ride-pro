import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { redirectToLogin } from './auth-navigation';

describe('auth-navigation', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // @ts-ignore
    delete window.location;
    window.location = {
      ...originalLocation,
      pathname: '/home',
      replace: vi.fn(),
    } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('redirects to login when window is defined and not on login page', () => {
    redirectToLogin();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });

  it('does not redirect if already on login page', () => {
    window.location.pathname = '/login';
    redirectToLogin();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('does not redirect when window is undefined', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete globalThis.window;

    try {
      expect(() => redirectToLogin()).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
