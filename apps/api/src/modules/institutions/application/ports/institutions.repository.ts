export const INSTITUTIONS_REPOSITORY = Symbol('INSTITUTIONS_REPOSITORY');

export type InstitutionSummary = {
  id: string;
  name: string;
  code: string;
  domains: string[];
  isActive: boolean;
};

export type InstitutionSettingsRecord = {
  institutionId: string;
  allowCashPayments: boolean;
  allowPaypalPayments: boolean;
  allowWalletPayments?: boolean;
  termsDocumentUrl: string | null;
  privacyPolicyUrl: string | null;
  safetyRulesTitle: string;
  safetyRulesSummary: string;
  safetyRulesBody: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type CreateInstitutionInput = {
  name: string;
  code: string;
  domains: string[];
};

export type UpdateInstitutionSettingsInput = {
  institutionId: string;
  allowCashPayments: boolean;
  allowPaypalPayments: boolean;
  allowWalletPayments: boolean;
  termsDocumentUrl?: string | null;
  privacyPolicyUrl?: string | null;
  safetyRulesTitle: string;
  safetyRulesSummary: string;
  safetyRulesBody: string;
};

export interface InstitutionsRepository {
  listActive(): Promise<InstitutionSummary[]>;
  create(input: CreateInstitutionInput): Promise<InstitutionSummary>;
  findById(institutionId: string): Promise<InstitutionSummary | null>;
  updateStatus(institutionId: string, isActive: boolean): Promise<InstitutionSummary>;
  getSettings(institutionId: string): Promise<InstitutionSettingsRecord>;
  updateSettings(input: UpdateInstitutionSettingsInput): Promise<InstitutionSettingsRecord>;
}
