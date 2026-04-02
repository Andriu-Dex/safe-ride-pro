import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  DriverDocumentStorageService,
  RetrievedDriverDocument,
  StoredDriverDocument,
} from '../../application/ports/driver-document-storage.service';
import { DriverDocumentType } from '../../application/ports/drivers.repository';

const DRIVER_DOCUMENTS_BASE_DIRECTORY = resolve(
  process.cwd(),
  'storage',
  'private',
  'driver-documents',
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
export class LocalDriverDocumentStorageService implements DriverDocumentStorageService {
  async storeDocument(input: {
    membershipId: string;
    documentType: DriverDocumentType;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredDriverDocument> {
    const extension =
      EXTENSION_BY_MIME_TYPE[input.mimeType] ||
      extname(input.fileName).toLowerCase() ||
      '.bin';
    const relativeFileKey = `${input.membershipId}/${input.documentType}/${randomUUID()}${extension}`;
    const absolutePath = this.resolveAbsolutePath(relativeFileKey);

    await mkdir(resolve(absolutePath, '..'), { recursive: true });

    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, input.content);
    } catch {
      throw new InternalServerErrorException(
        'No fue posible guardar el documento del conductor.',
      );
    }

    return {
      fileKey: relativeFileKey,
    };
  }

  async readDocument(fileKey: string): Promise<RetrievedDriverDocument> {
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
      throw new NotFoundException('El documento solicitado no existe.');
    }
  }

  private resolveAbsolutePath(fileKey: string): string {
    const normalizedFileKey = fileKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const absolutePath = resolve(DRIVER_DOCUMENTS_BASE_DIRECTORY, normalizedFileKey);

    if (!absolutePath.startsWith(DRIVER_DOCUMENTS_BASE_DIRECTORY)) {
      throw new NotFoundException('El documento solicitado no existe.');
    }

    return absolutePath;
  }
}
