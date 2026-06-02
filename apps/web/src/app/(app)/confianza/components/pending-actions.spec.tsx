import { TripClosureIncidentType } from '@saferidepro/shared-types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type {
  RatingParticipationOpportunity,
  ReportParticipationOpportunity,
} from '../types/trust-types';
import { PendingActions } from './pending-actions';

function buildRatingOpportunity(
  overrides: Partial<RatingParticipationOpportunity> = {},
): RatingParticipationOpportunity {
  return {
    id: 'trip-1:driver-1',
    tripId: 'trip-1',
    targetMembershipId: 'driver-1',
    targetFullName: 'Steven Conductor',
    tripOriginLabel: 'Campus Huachi',
    tripDestinationLabel: 'Santa Rosa',
    tripDepartureAt: '2030-01-01T10:00:00.000Z',
    ratingDirectionLabel: 'Calificar al conductor',
    windowClosesAt: '2030-01-04T10:00:00.000Z',
    ...overrides,
  };
}

function buildReportOpportunity(
  overrides: Partial<ReportParticipationOpportunity> = {},
): ReportParticipationOpportunity {
  return {
    id: 'trip-2:passenger-1',
    tripId: 'trip-2',
    targetMembershipId: 'passenger-1',
    targetFullName: 'Andrea Pasajera',
    tripOriginLabel: 'Campus Huachi',
    tripDestinationLabel: 'Santa Rosa',
    tripDepartureAt: '2030-01-01T11:00:00.000Z',
    reportDirectionLabel: 'Reportar al pasajero',
    incidentType: TripClosureIncidentType.DriverAbsence,
    incidentLabel: 'Ausencia del conductor',
    incidentTone: 'danger',
    incidentSummary: 'El viaje no se ejecuto.',
    suggestedReason: 'NO_SHOW',
    tripClosureNote: null,
    windowClosesAt: '2030-01-04T11:00:00.000Z',
    ...overrides,
  };
}

describe('PendingActions', () => {
  it('renders action cards and dispatches the selected opportunity', async () => {
    const ratingOpportunity = buildRatingOpportunity();
    const reportOpportunity = buildReportOpportunity();
    const setActiveRatingOpportunity = vi.fn();
    const setActiveReportOpportunity = vi.fn();

    render(
      <PendingActions
        pendingRatingOpportunities={[ratingOpportunity]}
        pendingReportOpportunities={[reportOpportunity]}
        totalPendingActions={2}
        highlightedRatingOpportunityIds={new Set([ratingOpportunity.id])}
        highlightedReportOpportunityIds={new Set()}
        setActiveRatingOpportunity={setActiveRatingOpportunity}
        setActiveReportOpportunity={setActiveReportOpportunity}
      />,
    );

    expect(screen.getByText('Pendientes')).toBeInTheDocument();
    expect(screen.getByText('2 activos')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones')).toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.getAllByText(/Cierra:/)).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Calificar' }));
    await user.click(screen.getByRole('button', { name: 'Reportar' }));

    expect(setActiveRatingOpportunity).toHaveBeenCalledWith(ratingOpportunity);
    expect(setActiveReportOpportunity).toHaveBeenCalledWith(reportOpportunity);
  });

  it('does not render the section when there are no pending actions', () => {
    const { container } = render(
      <PendingActions
        pendingRatingOpportunities={[]}
        pendingReportOpportunities={[]}
        totalPendingActions={0}
        highlightedRatingOpportunityIds={new Set()}
        highlightedReportOpportunityIds={new Set()}
        setActiveRatingOpportunity={vi.fn()}
        setActiveReportOpportunity={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
