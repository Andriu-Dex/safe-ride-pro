import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import { TripRequestCancelConfirmationModal } from './trip-request-cancel-confirmation-modal';

describe('TripRequestCancelConfirmationModal', () => {
  const request = {
    tripOriginLabel: 'UTA',
    tripDestinationLabel: 'Santa Rosa',
  } as TripRequestRecord;

  it('does not render without a selected request', () => {
    const { container } = render(
      <TripRequestCancelConfirmationModal
        isCancelling={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        request={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('confirms or closes request cancellation', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <TripRequestCancelConfirmationModal
        isCancelling={false}
        onClose={onClose}
        onConfirm={onConfirm}
        request={request}
      />,
    );

    const user = userEvent.setup();

    expect(screen.getByRole('dialog', { name: 'Cancelar solicitud' })).toBeInTheDocument();
    expect(screen.getByText('UTA -> Santa Rosa')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks actions while cancellation is in progress', () => {
    render(
      <TripRequestCancelConfirmationModal
        isCancelling
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        request={request}
      />,
    );

    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelando...' })).toBeDisabled();
  });
});
