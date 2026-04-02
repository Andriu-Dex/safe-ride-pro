import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import {
  ExistingStoredProfileImage,
  ProfileImageStorageService,
  StoredProfileImage,
} from '../../application/ports/profile-image-storage.service';

type ImgurUploadResponse = {
  success: boolean;
  data?: {
    link?: string;
    deletehash?: string;
  };
};

@Injectable()
export class ImgurProfileImageStorageService implements ProfileImageStorageService {
  private readonly logger = new Logger(ImgurProfileImageStorageService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async uploadProfileImage(input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
    previousImage?: ExistingStoredProfileImage | null;
  }): Promise<StoredProfileImage> {
    const clientId = this.environmentService.imgurClientId;

    if (!clientId) {
      throw new ServiceUnavailableException(
        'La subida de imagenes no esta disponible en este entorno.',
      );
    }

    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array(input.content)], { type: input.mimeType }),
      input.fileName,
    );
    formData.append('type', 'file');

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Imgur upload failed: ${response.status} ${body}`);
      throw new InternalServerErrorException(
        'No fue posible subir la imagen de perfil en este momento.',
      );
    }

    const payload = (await response.json()) as ImgurUploadResponse;
    const url = payload.data?.link?.trim();
    const storageKey = payload.data?.deletehash?.trim();

    if (!payload.success || !url || !storageKey) {
      this.logger.error(`Imgur upload returned an invalid payload: ${JSON.stringify(payload)}`);
      throw new InternalServerErrorException(
        'No fue posible procesar la imagen de perfil subida.',
      );
    }

    await this.deletePreviousImageIfNeeded(input.previousImage, clientId);

    return {
      url,
      storageProvider: 'IMGUR',
      storageKey,
    };
  }

  private async deletePreviousImageIfNeeded(
    previousImage: ExistingStoredProfileImage | null | undefined,
    clientId: string,
  ): Promise<void> {
    if (
      !previousImage ||
      previousImage.storageProvider !== 'IMGUR' ||
      !previousImage.storageKey
    ) {
      return;
    }

    try {
      await fetch(`https://api.imgur.com/3/image/${previousImage.storageKey}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Client-ID ${clientId}`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete previous Imgur profile image: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
