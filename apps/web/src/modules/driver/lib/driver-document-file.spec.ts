import { describe, expect, it, vi } from 'vitest';
import { buildDriverDocumentFileName } from './driver-document-file';

// Mock the helper function getFileExtensionFromMimeType
vi.mock('../../../lib/blob-file', () => ({
  getFileExtensionFromMimeType: vi.fn((mime: string) => {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'application/pdf') return 'pdf';
    return 'bin';
  }),
}));

describe('driver-document-file', () => {
  it('builds file name for identity document and normalizes name', () => {
    const fileName = buildDriverDocumentFileName('identity', '  Juan Perez Prado ', 'image/jpeg');
    expect(fileName).toBe('documento-identidad-juan-perez-prado.jpg');
  });

  it('builds file name for license document and normalizes name', () => {
    const fileName = buildDriverDocumentFileName('license', 'Juan Perez  Prado', 'application/pdf');
    expect(fileName).toBe('documento-licencia-juan-perez-prado.pdf');
  });
});
