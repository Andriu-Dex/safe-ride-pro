export const INSTITUTIONS_REPOSITORY = Symbol('INSTITUTIONS_REPOSITORY');

export type InstitutionSummary = {
  id: string;
  name: string;
  code: string;
  domains: string[];
  isActive: boolean;
};

export type CreateInstitutionInput = {
  name: string;
  code: string;
  domains: string[];
};

export interface InstitutionsRepository {
  listActive(): Promise<InstitutionSummary[]>;
  create(input: CreateInstitutionInput): Promise<InstitutionSummary>;
  findById(institutionId: string): Promise<InstitutionSummary | null>;
  updateStatus(institutionId: string, isActive: boolean): Promise<InstitutionSummary>;
}
