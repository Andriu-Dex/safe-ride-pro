import { GlobalUserRole } from '@saferidepro/shared-types';

export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

export interface AccessTokenService {
  sign(userId: string, globalRole: GlobalUserRole): Promise<string>;
}
