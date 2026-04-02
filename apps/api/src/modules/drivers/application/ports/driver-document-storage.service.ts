import { DriverDocumentType } from './drivers.repository';

export const DRIVER_DOCUMENT_STORAGE_SERVICE = Symbol(
  'DRIVER_DOCUMENT_STORAGE_SERVICE',
);

export type StoredDriverDocument = {
  fileKey: string;
};

export type RetrievedDriverDocument = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

export interface DriverDocumentStorageService {
  storeDocument(input: {
    membershipId: string;
    documentType: DriverDocumentType;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredDriverDocument>;
  readDocument(fileKey: string): Promise<RetrievedDriverDocument>;
}
