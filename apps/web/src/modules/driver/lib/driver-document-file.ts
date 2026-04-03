import { getFileExtensionFromMimeType } from '../../../lib/blob-file';
import type { DriverDocumentType } from '../types/driver';

export function buildDriverDocumentFileName(
  documentType: DriverDocumentType,
  userFullName: string,
  mimeType: string,
) {
  const extension = getFileExtensionFromMimeType(mimeType);
  const normalizedName = userFullName.trim().toLowerCase().replace(/\s+/g, '-');

  return `${
    documentType === 'identity' ? 'documento-identidad' : 'documento-licencia'
  }-${normalizedName}.${extension}`;
}
