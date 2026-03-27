import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalUserRole } from '@saferidepro/shared-types';

import { AccessTokenService } from '../../application/ports/access-token.service';

@Injectable()
export class JwtAccessTokenService implements AccessTokenService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async sign(userId: string, globalRole: GlobalUserRole): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      globalRole,
    });
  }
}
