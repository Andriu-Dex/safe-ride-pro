import {
  matchesTripDepartureTimeWindow,
  parseTripDateFilterEnd,
  parseTripDateFilterStart,
  parseTripTimeFilter,
} from '../../../src/modules/trips/application/services/trip-search-filtering';

describe('trip-search-filtering', () => {
  describe('parseTripDateFilterStart', () => {
    it('parses date string to start of day in Ecuador time zone (-05:00)', () => {
      const date = parseTripDateFilterStart('2030-05-15');
      // 2030-05-15T00:00:00-05:00 is 2030-05-15T05:00:00Z
      expect(date.toISOString()).toBe('2030-05-15T05:00:00.000Z');
    });
  });

  describe('parseTripDateFilterEnd', () => {
    it('parses date string to end of day in Ecuador time zone (-05:00)', () => {
      const date = parseTripDateFilterEnd('2030-05-15');
      // 2030-05-15T23:59:59.999-05:00 is 2030-05-16T04:59:59.999Z
      expect(date.toISOString()).toBe('2030-05-16T04:59:59.999Z');
    });
  });

  describe('parseTripTimeFilter', () => {
    it('returns undefined for empty, null, or invalid formats', () => {
      expect(parseTripTimeFilter(undefined)).toBeUndefined();
      expect(parseTripTimeFilter('')).toBeUndefined();
      expect(parseTripTimeFilter('12')).toBeUndefined();
      expect(parseTripTimeFilter('12:ab')).toBeUndefined();
      expect(parseTripTimeFilter('25:00')).toBeUndefined(); // TRIP_TIME_FILTER_PATTERN should reject hours > 23
    });

    it('parses valid HH:MM strings to total minutes', () => {
      expect(parseTripTimeFilter('00:00')).toBe(0);
      expect(parseTripTimeFilter('05:30')).toBe(5 * 60 + 30);
      expect(parseTripTimeFilter('23:59')).toBe(23 * 60 + 59);
    });
  });

  describe('matchesTripDepartureTimeWindow', () => {
    it('returns true if no time window limits are defined', () => {
      const departure = new Date('2030-05-15T10:00:00.000Z');
      expect(matchesTripDepartureTimeWindow(departure)).toBe(true);
      expect(matchesTripDepartureTimeWindow(departure, undefined, undefined)).toBe(true);
    });

    it('resolves minutes in Ecuador time and checks bounds (both from and to defined)', () => {
      // 2030-05-15T12:00:00Z in Ecuador time (-05:00) is 07:00, which is 7 * 60 = 420 minutes
      const departure = new Date('2030-05-15T12:00:00.000Z');

      // Case: timeFrom <= timeTo
      expect(matchesTripDepartureTimeWindow(departure, 400, 440)).toBe(true);
      expect(matchesTripDepartureTimeWindow(departure, 430, 450)).toBe(false);

      // Case: timeFrom > timeTo (wrap-around for night shift)
      // e.g., from 22:00 (1320m) to 08:00 (480m)
      expect(matchesTripDepartureTimeWindow(departure, 1320, 480)).toBe(true); // 420 is <= 480
      expect(matchesTripDepartureTimeWindow(departure, 1320, 410)).toBe(false); // 420 is neither >= 1320 nor <= 410
    });

    it('checks bounds with only timeFrom defined', () => {
      // 2030-05-15T12:00:00Z -> 07:00 -> 420 minutes
      const departure = new Date('2030-05-15T12:00:00.000Z');
      expect(matchesTripDepartureTimeWindow(departure, 400, undefined)).toBe(true);
      expect(matchesTripDepartureTimeWindow(departure, 440, undefined)).toBe(false);
    });

    it('checks bounds with only timeTo defined', () => {
      // 2030-05-15T12:00:00Z -> 07:00 -> 420 minutes
      const departure = new Date('2030-05-15T12:00:00.000Z');
      expect(matchesTripDepartureTimeWindow(departure, undefined, 440)).toBe(true);
      expect(matchesTripDepartureTimeWindow(departure, undefined, 400)).toBe(false);
    });
  });
});
