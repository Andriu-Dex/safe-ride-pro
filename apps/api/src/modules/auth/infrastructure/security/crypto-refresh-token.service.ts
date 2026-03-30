import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import {
  RefreshTokenPayload,
  RefreshTokenService,
} from '../../application/ports/refresh-token.service';

@Injectable()
export class CryptoRefreshTokenService implements RefreshTokenService {
  issue(): RefreshTokenPayload {
    const token = randomBytes(48).toString('base64url');

    return {
      token,
      tokenHash: this.hash(token),
    };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
