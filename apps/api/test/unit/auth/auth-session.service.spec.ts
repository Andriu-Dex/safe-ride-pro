import { GlobalUserRole } from '@saferidepro/shared-types';

import type { AccessTokenService } from '../../../src/modules/auth/application/ports/access-token.service';
import type { RefreshTokenService } from '../../../src/modules/auth/application/ports/refresh-token.service';
import { AuthSessionService } from '../../../src/modules/auth/application/services/auth-session.service';
import type { EnvironmentService } from '../../../src/shared/infrastructure/config/environment.service';

function createAccessTokenServiceMock(): jest.Mocked<AccessTokenService> {
  return {
    sign: jest.fn(),
  };
}

function createRefreshTokenServiceMock(): jest.Mocked<RefreshTokenService> {
  return {
    issue: jest.fn(),
    hash: jest.fn(),
  };
}

describe('AuthSessionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-01-10T15:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues access and refresh tokens using the configured TTL', async () => {
    const accessTokenService = createAccessTokenServiceMock();
    const refreshTokenService = createRefreshTokenServiceMock();
    const environmentService = {
      refreshTokenTtlDays: 7,
    } as EnvironmentService;

    accessTokenService.sign.mockResolvedValue('access-token');
    refreshTokenService.issue.mockReturnValue({
      token: 'refresh-token',
      tokenHash: 'refresh-token-hash',
    });

    const service = new AuthSessionService(
      accessTokenService,
      refreshTokenService,
      environmentService,
    );

    const session = await service.issueTokens('user-1', GlobalUserRole.User);

    expect(accessTokenService.sign).toHaveBeenCalledWith('user-1', GlobalUserRole.User);
    expect(refreshTokenService.issue).toHaveBeenCalledTimes(1);
    expect(session).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenHash: 'refresh-token-hash',
      refreshTokenExpiresAt: new Date('2030-01-17T15:30:00.000Z'),
    });
  });

  it('supports different global roles without altering the token contract', async () => {
    const accessTokenService = createAccessTokenServiceMock();
    const refreshTokenService = createRefreshTokenServiceMock();
    const environmentService = {
      refreshTokenTtlDays: 1,
    } as EnvironmentService;

    accessTokenService.sign.mockResolvedValue('admin-access-token');
    refreshTokenService.issue.mockReturnValue({
      token: 'admin-refresh-token',
      tokenHash: 'admin-refresh-token-hash',
    });

    const service = new AuthSessionService(
      accessTokenService,
      refreshTokenService,
      environmentService,
    );

    const session = await service.issueTokens('admin-1', GlobalUserRole.SuperAdmin);

    expect(accessTokenService.sign).toHaveBeenCalledWith(
      'admin-1',
      GlobalUserRole.SuperAdmin,
    );
    expect(session.refreshTokenExpiresAt).toEqual(new Date('2030-01-11T15:30:00.000Z'));
  });
});
