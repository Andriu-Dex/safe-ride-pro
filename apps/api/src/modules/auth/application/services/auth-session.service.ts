import { Inject, Injectable } from '@nestjs/common';
import { GlobalUserRole } from '@saferidepro/shared-types';

import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import { ACCESS_TOKEN_SERVICE, AccessTokenService } from '../ports/access-token.service';
import {
  REFRESH_TOKEN_SERVICE,
  RefreshTokenService,
} from '../ports/refresh-token.service';

export type IssuedAuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
};

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async issueTokens(userId: string, globalRole: GlobalUserRole): Promise<IssuedAuthSession> {
    const accessToken = await this.accessTokenService.sign(userId, globalRole);
    const refreshTokenPayload = this.refreshTokenService.issue();
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.environmentService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    return {
      accessToken,
      refreshToken: refreshTokenPayload.token,
      refreshTokenHash: refreshTokenPayload.tokenHash,
      refreshTokenExpiresAt,
    };
  }
}
