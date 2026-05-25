import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateInstitutionInput,
  InstitutionSettingsRecord,
  InstitutionSummary,
  InstitutionsRepository,
  UpdateInstitutionSettingsInput,
} from '../../application/ports/institutions.repository';

const DEFAULT_SAFETY_RULES_TITLE = 'Reglas minimas de seguridad';
const DEFAULT_SAFETY_RULES_SUMMARY =
  'Respeta el punto de encuentro, confirma tu identidad y mantente atento durante todo el trayecto.';
const DEFAULT_SAFETY_RULES_BODY = [
  '1. Llega con anticipacion al punto acordado.',
  '2. Verifica conductor, vehiculo y placa antes de abordar.',
  '3. Mantente identificable y avisa cualquier cambio de ultimo momento.',
  '4. Usa el viaje solo para fines autorizados por tu institucion.',
  '5. Reporta de inmediato cualquier conducta insegura o fuera de protocolo.',
].join('\n');

@Injectable()
export class PrismaInstitutionsRepository implements InstitutionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<InstitutionSummary[]> {
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      include: {
        domains: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      code: institution.code,
      domains: institution.domains.map((domain) => domain.domain),
      isActive: institution.isActive,
    }));
  }

  async create(input: CreateInstitutionInput): Promise<InstitutionSummary> {
    const institution = await this.prisma.institution.create({
      data: {
        name: input.name,
        code: input.code,
        domains: {
          create: input.domains.map((domain, index) => ({
            domain,
            isPrimary: index === 0,
            isActive: true,
          })),
        },
      },
      include: {
        domains: {
          orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
        },
      },
    });

    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      domains: institution.domains.map((domain) => domain.domain),
      isActive: institution.isActive,
    };
  }

  async findById(institutionId: string): Promise<InstitutionSummary | null> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        domains: {
          orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
        },
      },
    });

    if (!institution) {
      return null;
    }

    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      domains: institution.domains.map((domain) => domain.domain),
      isActive: institution.isActive,
    };
  }

  async updateStatus(institutionId: string, isActive: boolean): Promise<InstitutionSummary> {
    const institution = await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        isActive,
      },
      include: {
        domains: {
          orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
        },
      },
    });

    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      domains: institution.domains.map((domain) => domain.domain),
      isActive: institution.isActive,
    };
  }

  async getSettings(institutionId: string): Promise<InstitutionSettingsRecord> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        settings: true,
      },
    });

    if (!institution) {
      throw new Error('INSTITUTION_NOT_FOUND');
    }

    return this.mapInstitutionSettings(institutionId, institution.settings);
  }

  async updateSettings(input: UpdateInstitutionSettingsInput): Promise<InstitutionSettingsRecord> {
    const settings = await this.prisma.institutionSettings.upsert({
      where: {
        institutionId: input.institutionId,
      },
      create: {
        institutionId: input.institutionId,
        allowCashPayments: input.allowCashPayments,
        allowPaypalPayments: input.allowPaypalPayments,
        allowWalletPayments: input.allowWalletPayments,
        termsDocumentUrl: input.termsDocumentUrl ?? null,
        privacyPolicyUrl: input.privacyPolicyUrl ?? null,
        safetyRulesTitle: input.safetyRulesTitle,
        safetyRulesSummary: input.safetyRulesSummary,
        safetyRulesBody: input.safetyRulesBody,
      },
      update: {
        allowCashPayments: input.allowCashPayments,
        allowPaypalPayments: input.allowPaypalPayments,
        allowWalletPayments: input.allowWalletPayments,
        termsDocumentUrl: input.termsDocumentUrl ?? null,
        privacyPolicyUrl: input.privacyPolicyUrl ?? null,
        safetyRulesTitle: input.safetyRulesTitle,
        safetyRulesSummary: input.safetyRulesSummary,
        safetyRulesBody: input.safetyRulesBody,
      },
    });

    return this.mapInstitutionSettings(input.institutionId, settings);
  }

  private mapInstitutionSettings(
    institutionId: string,
    settings: {
      allowCashPayments: boolean;
      allowPaypalPayments: boolean;
      allowWalletPayments: boolean;
      termsDocumentUrl: string | null;
      privacyPolicyUrl: string | null;
      safetyRulesTitle: string;
      safetyRulesSummary: string;
      safetyRulesBody: string;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ): InstitutionSettingsRecord {
    return {
      institutionId,
      allowCashPayments: settings?.allowCashPayments ?? true,
      allowPaypalPayments: settings?.allowPaypalPayments ?? true,
      allowWalletPayments: settings?.allowWalletPayments ?? true,
      termsDocumentUrl: settings?.termsDocumentUrl ?? null,
      privacyPolicyUrl: settings?.privacyPolicyUrl ?? null,
      safetyRulesTitle: settings?.safetyRulesTitle ?? DEFAULT_SAFETY_RULES_TITLE,
      safetyRulesSummary: settings?.safetyRulesSummary ?? DEFAULT_SAFETY_RULES_SUMMARY,
      safetyRulesBody: settings?.safetyRulesBody ?? DEFAULT_SAFETY_RULES_BODY,
      createdAt: settings?.createdAt ?? null,
      updatedAt: settings?.updatedAt ?? null,
    };
  }
}
