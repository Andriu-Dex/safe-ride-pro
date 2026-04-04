import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  RetrievedVehicleDocument,
  StoredVehicleDocument,
  VehicleDocumentStorageService,
} from '../../application/ports/vehicle-document-storage.service';

const VEHICLE_DOCUMENTS_BASE_DIRECTORY = resolve(
  process.cwd(),
  'storage',
  'private',
  'vehicle-documents',
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
export class LocalVehicleDocumentStorageService
  implements VehicleDocumentStorageService
{
  async storeRegistrationDocument(input: {
    membershipId: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredVehicleDocument> {
    const extension =
      EXTENSION_BY_MIME_TYPE[input.mimeType] ||
      extname(input.fileName).toLowerCase() ||
      '.bin';
    const relativeFileKey = `${input.membershipId}/registration/${randomUUID()}${extension}`;
    const absolutePath = this.resolveAbsolutePath(relativeFileKey);

    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, input.content);
    } catch {
      throw new InternalServerErrorException(
        'No fue posible guardar el documento del vehiculo.',
      );
    }

    return {
      fileKey: relativeFileKey,
    };
  }

  async readRegistrationDocument(fileKey: string): Promise<RetrievedVehicleDocument> {
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
    const absolutePath = resolve(VEHICLE_DOCUMENTS_BASE_DIRECTORY, normalizedFileKey);

    if (!absolutePath.startsWith(VEHICLE_DOCUMENTS_BASE_DIRECTORY)) {
      throw new NotFoundException('El documento solicitado no existe.');
    }

    return absolutePath;
  }
}
