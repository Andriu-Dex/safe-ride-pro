export const REPORT_EVIDENCE_STORAGE_SERVICE = Symbol(
  'REPORT_EVIDENCE_STORAGE_SERVICE',
);

export type StoredReportEvidence = {
  fileKey: string;
};

export type RetrievedReportEvidence = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

export interface ReportEvidenceStorageService {
  storeEvidence(input: {
    membershipId: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<StoredReportEvidence>;
  readEvidence(fileKey: string): Promise<RetrievedReportEvidence>;
}
