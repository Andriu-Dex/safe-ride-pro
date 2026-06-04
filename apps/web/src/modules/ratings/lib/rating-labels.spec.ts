import { describe, expect, it } from 'vitest';

import { getRatingStars } from './rating-labels';

describe('rating-labels', () => {
  it('formats scores as five-star strings and clamps invalid ranges', () => {
    expect(getRatingStars(0)).toBe('☆☆☆☆☆');
    expect(getRatingStars(3)).toBe('★★★☆☆');
    expect(getRatingStars(5)).toBe('★★★★★');
    expect(getRatingStars(-2)).toBe('☆☆☆☆☆');
    expect(getRatingStars(8)).toBe('★★★★★');
  });
});
