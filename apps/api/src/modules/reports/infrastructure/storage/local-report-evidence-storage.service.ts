import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  ReportEvidenceStorageService,
  RetrievedReportEvidence,
  StoredReportEvidence,
} from '../../application/ports/report-evidence-storage.service';

const REPORT_EVIDENCE_BASE_DIRECTORY = resolve(
  process.cwd(),
  'storage',
  'private',
  'report-evidence',
);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class LocalReportEvidenceStorageService
  implements ReportEvidenceStorageService
{
  async storeEvidence(input: {
    membershipId: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredReportEvidence> {
    const extension =
      EXTENSION_BY_MIME_TYPE[input.mimeType] ||
      extname(input.fileName).toLowerCase() ||
      '.bin';
    const relativeFileKey = `${input.membershipId}/${randomUUID()}${extension}`;
    const absolutePath = this.resolveAbsolutePath(relativeFileKey);

    await mkdir(resolve(absolutePath, '..'), { recursive: true });

    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, input.content);
    } catch {
      throw new InternalServerErrorException(
        'No fue posible guardar la evidencia del reporte.',
      );
    }

    return {
      fileKey: relativeFileKey,
    };
  }

  async readEvidence(fileKey: string): Promise<RetrievedReportEvidence> {
    const absolutePath = this.resolveAbsolutePath(fileKey);

    try {
      const content = await readFile(absolutePath);
      const extension = extname(absolutePath).toLowerCase();

      return {
        fileName: basename(absolutePath),
        mimeType: MIME_TYPE_BY_EXTENSION[extension] || 'application/octet-stream',
        content,
      };
    } catch {
      throw new NotFoundException('La evidencia solicitada no existe.');
    }
  }

  private resolveAbsolutePath(fileKey: string): string {
    const normalizedFileKey = fileKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const absolutePath = resolve(REPORT_EVIDENCE_BASE_DIRECTORY, normalizedFileKey);

    if (!absolutePath.startsWith(REPORT_EVIDENCE_BASE_DIRECTORY)) {
      throw new NotFoundException('La evidencia solicitada no existe.');
    }

    return absolutePath;
  }
}
