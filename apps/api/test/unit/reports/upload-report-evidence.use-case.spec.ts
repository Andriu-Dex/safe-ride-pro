import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import type { ReportEvidenceStorageService } from '../../../src/modules/reports/application/ports/report-evidence-storage.service';
import type { ReportsRepository } from '../../../src/modules/reports/application/ports/reports.repository';
import { UploadReportEvidenceUseCase } from '../../../src/modules/reports/application/use-cases/upload-report-evidence.use-case';

function createReportsRepositoryMock(): jest.Mocked<ReportsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    hasReportableTripParticipation: jest.fn(),
    findReportById: jest.fn(),
    findExistingReport: jest.fn(),
    createReport: jest.fn(),
    listReportsByReporterMembershipId: jest.fn(),
    listReviewableReports: jest.fn(),
    reviewReport: jest.fn(),
  };
}

function createReportEvidenceStorageMock(): jest.Mocked<ReportEvidenceStorageService> {
  return {
    storeEvidence: jest.fn(),
    readEvidence: jest.fn(),
  };
}

describe('UploadReportEvidenceUseCase', () => {
  it('rejects unsupported mime types', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createReportEvidenceStorageMock();
    const useCase = new UploadReportEvidenceUseCase(repository, storage);

    await expect(
      useCase.execute('user-1', {
        originalname: 'evidence.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('hello'),
      }),
    ).rejects.toThrow(
      new BadRequestException('La evidencia debe estar en formato PDF, JPG, PNG o WEBP.'),
    );
  });

  it('rejects uploads when the user has no active membership', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createReportEvidenceStorageMock();
    const useCase = new UploadReportEvidenceUseCase(repository, storage);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Usuario Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Inactive,
    });

    await expect(
      useCase.execute('user-1', {
        originalname: 'evidence.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('pdf-content'),
      }),
    ).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para cargar evidencia.'),
    );
  });

  it('stores report evidence for an active membership', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createReportEvidenceStorageMock();
    const useCase = new UploadReportEvidenceUseCase(repository, storage);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Usuario Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    storage.storeEvidence.mockResolvedValue({
      fileKey: 'membership-1/evidence-1.png',
    });

    const response = await useCase.execute('user-1', {
      originalname: 'evidencia.png',
      mimetype: 'image/png',
      size: 2048,
      buffer: Buffer.from('image-content'),
    });

    expect(response.message).toBe('La evidencia del reporte se cargo correctamente.');
    expect(storage.storeEvidence).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      fileName: 'evidencia.png',
      mimeType: 'image/png',
      content: Buffer.from('image-content'),
    });
    expect(response.fileKey).toBe('membership-1/evidence-1.png');
  });
});
