import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TripAvailabilityFilter,
  TripRouteMode,
  VehicleType,
} from '@saferidepro/shared-types';
import { TripFiltersPanel } from './trip-filters-panel';

describe('TripFiltersPanel', () => {
  const onChange = vi.fn();
  const onApply = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
  const onReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates filter changes, submit and reset actions', async () => {
    render(
      <TripFiltersPanel
        isSubmitting={false}
        onApply={onApply}
        onChange={onChange}
        onReset={onReset}
        values={{
          origin: '',
          destination: '',
          dateFrom: '',
          dateTo: '',
          timeFrom: '',
          timeTo: '',
          routeMode: undefined,
          vehicleType: undefined,
          availability: undefined,
        }}
      />,
    );

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Origen'), 'Huachi');
    fireEvent.change(screen.getByLabelText('Hora desde'), {
      target: { value: '07:30' },
    });
    await user.selectOptions(screen.getByLabelText('Modo de ruta'), TripRouteMode.DirectRoute);
    await user.selectOptions(screen.getByLabelText('Tipo de vehiculo'), VehicleType.Car);
    await user.selectOptions(screen.getByLabelText('Disponibilidad'), TripAvailabilityFilter.Available);
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(onChange).toHaveBeenCalledWith('origin', 'H');
    expect(onChange).toHaveBeenCalledWith('timeFrom', '07:30');
    expect(onChange).toHaveBeenCalledWith('routeMode', TripRouteMode.DirectRoute);
    expect(onChange).toHaveBeenCalledWith('vehicleType', VehicleType.Car);
    expect(onChange).toHaveBeenCalledWith('availability', TripAvailabilityFilter.Available);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
