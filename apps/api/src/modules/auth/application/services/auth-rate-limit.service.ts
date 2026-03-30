import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

@Injectable()
export class AuthRateLimitService {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(key: string, policy: RateLimitPolicy, message: string): void {
    const timestamps = this.pruneExpiredAttempts(key, policy.windowMs);

    if (timestamps.length >= policy.limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  recordFailure(key: string, policy: RateLimitPolicy): void {
    const timestamps = this.pruneExpiredAttempts(key, policy.windowMs);

    timestamps.push(Date.now());
    this.attempts.set(key, timestamps);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  private pruneExpiredAttempts(key: string, windowMs: number): number[] {
    const now = Date.now();
    const currentAttempts = this.attempts.get(key) ?? [];
    const nextAttempts = currentAttempts.filter((timestamp) => now - timestamp < windowMs);

    if (nextAttempts.length === 0) {
      this.attempts.delete(key);
      return [];
    }

    this.attempts.set(key, nextAttempts);

    return nextAttempts;
  }
}
