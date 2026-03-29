import {
  AccountStatus,
  DocumentType,
  GlobalUserRole,
} from '@saferidepro/shared-types';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '../types/auth-session';

import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from './auth-storage';

const TEST_SESSION: AuthSession = {
  accessToken: 'token-123',
  user: {
    id: 'user-1',
    email: 'admin@uta.edu.ec',
    fullName: 'SafeRidePro Admin',
    phone: null,
    documentType: DocumentType.NationalId,
    documentNumber: '0123456789',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: '2026-03-29T00:00:00.000Z',
    memberships: [],
  },
};

describe('auth-storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes and reads the stored session', () => {
    writeStoredSession(TEST_SESSION);

    expect(readStoredSession()).toEqual(TEST_SESSION);
  });

  it('removes invalid stored session payloads', () => {
    window.localStorage.setItem('saferidepro.auth.session', '{invalid-json');

    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.getItem('saferidepro.auth.session')).toBeNull();
  });

  it('clears the stored session', () => {
    writeStoredSession(TEST_SESSION);
    clearStoredSession();

    expect(readStoredSession()).toBeNull();
  });
});
