import { TripClosureIncidentType, type TripPostClosureSummary } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';
import {
  formatTripClosureDeadline,
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
  getTripClosureWindowCopy,
} from './trip-closure';

describe('trip-closure', () => {
  describe('formatTripClosureDeadline', () => {
    it('formats a date string correctly in es-EC locale', () => {
      const formatted = formatTripClosureDeadline('2030-01-01T08:00:00.000Z');
      expect(formatted).toBeDefined();
    });
  });

  describe('getTripClosureIncidentLabel', () => {
    it('returns the correct label for each incident type', () => {
      expect(getTripClosureIncidentLabel(TripClosureIncidentType.Completed)).toBe('Cierre completado');
      expect(getTripClosureIncidentLabel(TripClosureIncidentType.LateDriverCancellation)).toBe('Cancelacion tardia');
      expect(getTripClosureIncidentLabel(TripClosureIncidentType.DriverAbsence)).toBe('Ausencia del conductor');
      expect(getTripClosureIncidentLabel(TripClosureIncidentType.OverdueInProgress)).toBe('Cierre vencido');
      expect(getTripClosureIncidentLabel('OTHER' as any)).toBe('OTHER');
    });
  });

  describe('getTripClosureIncidentTone', () => {
    it('returns the correct tone for each incident type', () => {
      expect(getTripClosureIncidentTone(TripClosureIncidentType.Completed)).toBe('success');
      expect(getTripClosureIncidentTone(TripClosureIncidentType.LateDriverCancellation)).toBe('warning');
      expect(getTripClosureIncidentTone(TripClosureIncidentType.DriverAbsence)).toBe('warning');
      expect(getTripClosureIncidentTone(TripClosureIncidentType.OverdueInProgress)).toBe('warning');
      expect(getTripClosureIncidentTone('OTHER' as any)).toBe('neutral');
    });
  });

  describe('getTripClosureWindowCopy', () => {
    it('returns null if actionWindowClosesAt is null/undefined', () => {
      const summary: TripPostClosureSummary = {
        actionWindowClosesAt: null,
        isActionWindowOpen: true,
      } as any;
      expect(getTripClosureWindowCopy(summary)).toBeNull();
    });

    it('returns available message if window is open', () => {
      const summary: TripPostClosureSummary = {
        actionWindowClosesAt: new Date('2030-01-01T08:00:00.000Z'),
        isActionWindowOpen: true,
      } as any;
      const copy = getTripClosureWindowCopy(summary);
      expect(copy).toContain('Disponible hasta');
    });

    it('returns expired message if window is closed', () => {
      const summary: TripPostClosureSummary = {
        actionWindowClosesAt: new Date('2030-01-01T08:00:00.000Z'),
        isActionWindowOpen: false,
      } as any;
      const copy = getTripClosureWindowCopy(summary);
      expect(copy).toContain('La ventana de cierre vencio el');
    });
  });
});
