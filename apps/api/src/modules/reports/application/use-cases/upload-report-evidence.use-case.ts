import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  REPORT_EVIDENCE_STORAGE_SERVICE,
  ReportEvidenceStorageService,
} from '../ports/report-evidence-storage.service';
import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

type UploadedReportEvidenceFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_REPORT_EVIDENCE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_REPORT_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class UploadReportEvidenceUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    @Inject(REPORT_EVIDENCE_STORAGE_SERVICE)
    private readonly reportEvidenceStorageService: ReportEvidenceStorageService,
  ) {}

  async execute(userId: string, file: UploadedReportEvidenceFile | undefined) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo antes de continuar.');
    }

    if (!ALLOWED_REPORT_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'La evidencia debe estar en formato PDF, JPG, PNG o WEBP.',
      );
    }

    if (file.size > MAX_REPORT_EVIDENCE_SIZE_BYTES) {
      throw new BadRequestException('La evidencia no puede superar los 8 MB.');
    }

    const membership =
      await this.reportsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException(
        'No tienes una membresia activa para cargar evidencia.',
      );
    }

    const storedEvidence = await this.reportEvidenceStorageService.storeEvidence({
      membershipId: membership.id,
      fileName: file.originalname || 'report-evidence',
      mimeType: file.mimetype,
      content: file.buffer,
    });

    return {
      message: 'La evidencia del reporte se cargo correctamente.',
      fileKey: storedEvidence.fileKey,
    };
  }
}
