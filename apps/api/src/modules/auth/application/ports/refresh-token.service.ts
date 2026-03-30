export const REFRESH_TOKEN_SERVICE = Symbol('REFRESH_TOKEN_SERVICE');

export type RefreshTokenPayload = {
  token: string;
  tokenHash: string;
};

export interface RefreshTokenService {
  issue(): RefreshTokenPayload;
  hash(token: string): string;
}
