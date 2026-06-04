import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RatingOpportunityCard, type RatingOpportunity } from './rating-opportunity-card';

const opportunity: RatingOpportunity = {
  id: 'rating-opportunity-1',
  tripId: 'trip-1',
  targetMembershipId: 'membership-driver',
  targetFullName: 'Steven Conductor',
  tripOriginLabel: 'UTA',
  tripDestinationLabel: 'Santa Rosa',
  tripDepartureAt: '2030-01-01T10:00:00.000Z',
  directionLabel: 'Conductor',
  windowClosesAt: '2030-01-04T10:00:00.000Z',
};

describe('RatingOpportunityCard', () => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a score before submitting a rating', async () => {
    render(
      <RatingOpportunityCard
        isSubmitting={false}
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
        opportunity={opportunity}
        value={{ score: '0', comment: '' }}
      />,
    );

    const user = userEvent.setup();
    const submitButton = screen.getByRole('button', { name: 'Registrar calificación' });

    expect(screen.getByText('Steven Conductor')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Calificar con 4 estrellas' }));

    expect(onChange).toHaveBeenCalledWith('score', '4');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits and closes when the draft is valid', async () => {
    render(
      <RatingOpportunityCard
        isSubmitting={false}
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
        opportunity={opportunity}
        value={{ score: '5', comment: 'Excelente servicio' }}
      />,
    );

    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText('Comentario (Opcional)'), {
      target: { value: 'Excelente servicio puntual' },
    });
    await user.click(screen.getByRole('button', { name: 'Registrar calificación' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onChange).toHaveBeenCalledWith('comment', 'Excelente servicio puntual');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
