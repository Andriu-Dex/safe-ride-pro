export const PROFILE_IMAGE_STORAGE_SERVICE = Symbol('PROFILE_IMAGE_STORAGE_SERVICE');

export type ProfileImageStorageProvider = 'IMGUR';

export type StoredProfileImage = {
  url: string;
  storageProvider: ProfileImageStorageProvider;
  storageKey: string;
};

export type ExistingStoredProfileImage = {
  url: string | null;
  storageProvider: ProfileImageStorageProvider | null;
  storageKey: string | null;
};

export interface ProfileImageStorageService {
  uploadProfileImage(input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
    previousImage?: ExistingStoredProfileImage | null;
  }): Promise<StoredProfileImage>;
}
