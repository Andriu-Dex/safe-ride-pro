export const INSTITUTIONS_REPOSITORY = Symbol('INSTITUTIONS_REPOSITORY');

export type InstitutionSummary = {
  id: string;
  name: string;
  code: string;
  domains: string[];
};

export type CreateInstitutionInput = {
  name: string;
  code: string;
  domains: string[];
};

export interface InstitutionsRepository {
  listActive(): Promise<InstitutionSummary[]>;
  create(input: CreateInstitutionInput): Promise<InstitutionSummary>;
}
