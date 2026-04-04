export const VEHICLE_DOCUMENT_STORAGE_SERVICE = Symbol(
  'VEHICLE_DOCUMENT_STORAGE_SERVICE',
);

export type StoredVehicleDocument = {
  fileKey: string;
};

export type RetrievedVehicleDocument = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

export interface VehicleDocumentStorageService {
  storeRegistrationDocument(input: {
    membershipId: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredVehicleDocument>;
  readRegistrationDocument(fileKey: string): Promise<RetrievedVehicleDocument>;
}
