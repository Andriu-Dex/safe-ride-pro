import { ReportStatus, TripStatus } from '@saferidepro/shared-types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { RatingList, RatingRecord } from '../../../../modules/ratings/types/rating';
import type { ReportRecord } from '../../../../modules/reports/types/report';
import { ActivityHistory } from './activity-history';

function buildRatingRecord(overrides: Partial<RatingRecord> = {}): RatingRecord {
  return {
    id: 'rating-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    authorMembershipId: 'author-membership-1',
    authorUserId: 'author-user-1',
    authorFullName: 'Carlos Pasajero',
    targetMembershipId: 'target-membership-1',
    targetUserId: 'target-user-1',
    targetFullName: 'Steven Conductor',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Campus Huachi',
    tripDestinationLabel: 'Santa Rosa',
    tripDepartureAt: '2030-01-01T10:00:00.000Z',
    score: 4,
    comment: 'Conduccion ordenada y puntual.',
    createdAt: '2030-01-01T10:30:00.000Z',
    ...overrides,
  };
}

function buildReportRecord(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: 'report-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    reporterMembershipId: 'reporter-membership-1',
    reporterUserId: 'reporter-user-1',
    reporterFullName: 'Steven Conductor',
    reportedMembershipId: 'reported-membership-1',
    reportedUserId: 'reported-user-1',
    reportedFullName: 'Andrea Pasajera',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Campus Huachi',
    tripDestinationLabel: 'Santa Rosa',
    tripDepartureAt: '2030-01-01T10:00:00.000Z',
    tripCompletedAt: '2030-01-01T10:30:00.000Z',
    tripClosureNote: null,
    status: ReportStatus.Pending,
    reason: 'UNSAFE_DRIVING',
    description: 'Uso del telefono durante el trayecto.',
    evidenceFileKey: null,
    reviewNote: 'Se revisara con moderacion.',
    reviewedAt: '2030-01-01T11:00:00.000Z',
    reviewedByUserId: 'admin-1',
    reviewedByFullName: 'Admin Uno',
    createdAt: '2030-01-01T10:45:00.000Z',
    updatedAt: '2030-01-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHistory', () => {
  it('renders the compact report history with accessible severity text', async () => {
    const ratings: RatingList = {
      given: [buildRatingRecord()],
      received: [],
    };

    render(<ActivityHistory ratings={ratings} reports={[buildReportRecord()]} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reportes (1)' }));

    expect(screen.getByText('Andrea Pasajera')).toBeInTheDocument();
    expect(screen.getByText('Alta severidad.')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de revision')).toBeInTheDocument();
    expect(screen.getByText(/Campus Huachi/)).toBeInTheDocument();
    expect(screen.getByText(/Tú:/)).toBeInTheDocument();
    expect(screen.getByText(/Soporte:/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no received ratings', async () => {
    const ratings: RatingList = {
      given: [],
      received: [],
    };

    render(<ActivityHistory ratings={ratings} reports={[]} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Recibidas (0)' }));

    expect(screen.getByText('Aún no has recibido calificaciones en la membresía activa.')).toBeInTheDocument();
  });
});
