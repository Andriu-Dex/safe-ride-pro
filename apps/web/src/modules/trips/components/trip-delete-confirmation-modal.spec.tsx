import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TripRecord } from '../types/trip';
import { TripDeleteConfirmationModal } from './trip-delete-confirmation-modal';

describe('TripDeleteConfirmationModal', () => {
  const trip = {
    originLabel: 'UTA',
    destinationLabel: 'Santa Rosa',
  } as TripRecord;

  it('does not render without a selected trip', () => {
    const { container } = render(
      <TripDeleteConfirmationModal
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        trip={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('confirms or cancels draft deletion', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <TripDeleteConfirmationModal
        isDeleting={false}
        onClose={onClose}
        onConfirm={onConfirm}
        trip={trip}
      />,
    );

    const user = userEvent.setup();

    expect(screen.getByRole('dialog', { name: 'Eliminar viaje' })).toBeInTheDocument();
    expect(screen.getByText('UTA → Santa Rosa')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
