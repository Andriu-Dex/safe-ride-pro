import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportOpportunityCard, type ReportOpportunity } from './report-opportunity-card';

const opportunity: ReportOpportunity = {
  id: 'report-opportunity-1',
  tripId: 'trip-1',
  reportedMembershipId: 'membership-passenger',
  reportedFullName: 'Andrea Pasajera',
  tripOriginLabel: 'UTA',
  tripDestinationLabel: 'Santa Rosa',
  tripDepartureAt: '2030-01-01T10:00:00.000Z',
  directionLabel: 'Pasajero',
  incidentLabel: 'Ausencia',
  incidentTone: 'warning',
  incidentSummary: 'El pasajero no abordo el viaje.',
  tripClosureNote: 'No se presento en el punto acordado.',
  windowClosesAt: '2030-01-04T10:00:00.000Z',
};

describe('ReportOpportunityCard', () => {
  const onChange = vi.fn();
  const onUploadEvidence = vi.fn();
  const onEvidenceValidationError = vi.fn();
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires reason and description before sending a report', async () => {
    render(
      <ReportOpportunityCard
        isSubmitting={false}
        isUploadingEvidence={false}
        onChange={onChange}
        onClose={onClose}
        onEvidenceValidationError={onEvidenceValidationError}
        onSubmit={onSubmit}
        onUploadEvidence={onUploadEvidence}
        opportunity={opportunity}
        value={{
          reason: 'NO_SHOW',
          description: '',
          evidenceFileKey: '',
          evidenceFileName: '',
          evidenceMimeType: null,
          evidencePreviewUrl: null,
        }}
      />,
    );

    const user = userEvent.setup();

    expect(screen.getByText('Andrea Pasajera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar Reporte Oficial' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Detalles del reporte'), {
      target: { value: 'No abordo el viaje' },
    });

    expect(onChange).toHaveBeenCalledWith('description', 'No abordo el viaje');
  });

  it('submits valid reports and validates evidence files', async () => {
    render(
      <ReportOpportunityCard
        isSubmitting={false}
        isUploadingEvidence={false}
        onChange={onChange}
        onClose={onClose}
        onEvidenceValidationError={onEvidenceValidationError}
        onSubmit={onSubmit}
        onUploadEvidence={onUploadEvidence}
        opportunity={opportunity}
        value={{
          reason: 'NO_SHOW',
          description: 'No abordo el viaje',
          evidenceFileKey: '',
          evidenceFileName: '',
          evidenceMimeType: null,
          evidencePreviewUrl: null,
        }}
      />,
    );

    const invalidFile = new File(['plain text'], 'nota.txt', { type: 'text/plain' });
    const validFile = new File(['content'], 'evidencia.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/Seleccionar archivo/i);

    fireEvent.change(input, { target: { files: [invalidFile] } });
    fireEvent.change(input, { target: { files: [validFile] } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enviar Reporte Oficial' }));

    expect(onEvidenceValidationError).toHaveBeenCalledWith(
      'La evidencia debe estar en formato PDF, JPG, PNG o WEBP.',
    );
    expect(onUploadEvidence).toHaveBeenCalledWith(validFile);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
