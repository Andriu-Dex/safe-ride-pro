import { describe, expect, it } from 'vitest';
import { getUserInitials } from './get-user-initials';

describe('getUserInitials', () => {
  it('extracts initials from full name', () => {
    expect(getUserInitials('Juan Perez')).toBe('JP');
    expect(getUserInitials('Juan Perez Prado')).toBe('JP');
    expect(getUserInitials('  Juan   Perez  ')).toBe('JP');
  });

  it('uses fallback when name is null, undefined, or empty', () => {
    expect(getUserInitials(null)).toBe('SR');
    expect(getUserInitials(undefined)).toBe('SR');
    expect(getUserInitials('')).toBe('SR');
    expect(getUserInitials('    ')).toBe('SR');
  });

  it('uses custom fallback when provided', () => {
    expect(getUserInitials(null, 'XY')).toBe('XY');
    expect(getUserInitials('', 'XY')).toBe('XY');
  });
});
