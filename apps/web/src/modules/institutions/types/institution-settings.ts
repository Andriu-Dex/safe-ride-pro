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
  termsDocumentUrl: string | null;
  privacyPolicyUrl: string | null;
  safetyRulesTitle: string;
  safetyRulesSummary: string;
  safetyRulesBody: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type InstitutionSettingsResponse = {
  institution: InstitutionSummary;
  settings: InstitutionSettingsRecord;
};

export type UpdateInstitutionSettingsInput = {
  allowCashPayments: boolean;
  allowPaypalPayments: boolean;
  termsDocumentUrl?: string;
  privacyPolicyUrl?: string;
  safetyRulesTitle: string;
  safetyRulesSummary: string;
  safetyRulesBody: string;
};
