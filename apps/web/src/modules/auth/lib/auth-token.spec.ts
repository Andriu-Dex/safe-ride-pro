import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import {
  getTokenExpirationTime,
  getMillisecondsUntilTokenExpiry,
  isTokenExpired,
} from './auth-token';

describe('auth-token', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const validPayload = { exp: Math.floor(new Date('2026-06-11T12:05:00.000Z').getTime() / 1000) };
  // Base64Url representation of validPayload
  const payloadBase64Url = Buffer.from(JSON.stringify(validPayload)).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const validToken = `header.${payloadBase64Url}.signature`;

  it('decodes base64url using window.atob when available', () => {
    const time = getTokenExpirationTime(validToken);
    expect(time).toBe(new Date('2026-06-11T12:05:00.000Z').getTime());
  });

  it('decodes base64url using Buffer when window is undefined', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete globalThis.window;

    try {
      const time = getTokenExpirationTime(validToken);
      expect(time).toBe(new Date('2026-06-11T12:05:00.000Z').getTime());
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('decodes base64url using Buffer when window.atob is not a function', () => {
    const originalAtob = window.atob;
    // @ts-ignore
    delete window.atob;

    try {
      const time = getTokenExpirationTime(validToken);
      expect(time).toBe(new Date('2026-06-11T12:05:00.000Z').getTime());
    } finally {
      window.atob = originalAtob;
    }
  });

  it('returns null if token does not have three parts', () => {
    expect(getTokenExpirationTime('invalidToken')).toBeNull();
    expect(getTokenExpirationTime('header.payload')).toBeNull();
  });

  it('returns null if payload base64url decoding fails', () => {
    expect(getTokenExpirationTime('header.%%%.signature')).toBeNull();
  });

  it('returns null if payload is not valid JSON', () => {
    const badPayload = 'not-json';
    const badPayloadB64 = Buffer.from(badPayload).toString('base64');
    expect(getTokenExpirationTime(`header.${badPayloadB64}.signature`)).toBeNull();
  });

  it('returns null if exp claim is missing or not a number', () => {
    const noExpPayload = {};
    const b64 = Buffer.from(JSON.stringify(noExpPayload)).toString('base64');
    expect(getTokenExpirationTime(`header.${b64}.signature`)).toBeNull();

    const nanExpPayload = { exp: NaN };
    const b64Nan = Buffer.from(JSON.stringify(nanExpPayload)).toString('base64');
    expect(getTokenExpirationTime(`header.${b64Nan}.signature`)).toBeNull();
  });

  it('calculates milliseconds until token expiry', () => {
    const ms = getMillisecondsUntilTokenExpiry(validToken);
    // 5 minutes = 300,000 ms
    expect(ms).toBe(300000);
  });

  it('returns null for milliseconds until expiry if token has no valid expiration', () => {
    expect(getMillisecondsUntilTokenExpiry('invalid')).toBeNull();
  });

  it('determines if token is expired', () => {
    expect(isTokenExpired(validToken)).toBe(false);

    // Advance time by 6 minutes
    vi.advanceTimersByTime(360000);
    expect(isTokenExpired(validToken)).toBe(true);
  });

  it('returns false for isTokenExpired if token expiration is null', () => {
    expect(isTokenExpired('invalid')).toBe(false);
  });
});
