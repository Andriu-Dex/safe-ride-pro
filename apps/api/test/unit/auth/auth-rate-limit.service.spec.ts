import { HttpException, HttpStatus } from '@nestjs/common';

import { AuthRateLimitService } from '../../../src/modules/auth/application/services/auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-01-10T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws too many requests after reaching the configured limit inside the window', () => {
    const service = new AuthRateLimitService();
    const policy = {
      limit: 2,
      windowMs: 60_000,
    };

    service.recordFailure('login:user@uta.edu.ec', policy);
    service.recordFailure('login:user@uta.edu.ec', policy);

    expect(() =>
      service.assertAllowed(
        'login:user@uta.edu.ec',
        policy,
        'Demasiados intentos de autenticacion.',
      ),
    ).toThrow(
      new HttpException(
        'Demasiados intentos de autenticacion.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('ignores expired failures once the time window has passed', () => {
    const service = new AuthRateLimitService();
    const policy = {
      limit: 1,
      windowMs: 60_000,
    };

    service.recordFailure('reset:user@uta.edu.ec', policy);

    jest.advanceTimersByTime(60_001);

    expect(() =>
      service.assertAllowed(
        'reset:user@uta.edu.ec',
        policy,
        'Demasiados intentos de recuperacion.',
      ),
    ).not.toThrow();
  });

  it('clears the tracked attempts for a key after a successful flow', () => {
    const service = new AuthRateLimitService();
    const policy = {
      limit: 1,
      windowMs: 60_000,
    };

    service.recordFailure('verify:user@uta.edu.ec', policy);
    service.clear('verify:user@uta.edu.ec');

    expect(() =>
      service.assertAllowed(
        'verify:user@uta.edu.ec',
        policy,
        'Demasiados intentos de verificacion.',
      ),
    ).not.toThrow();
  });
});
