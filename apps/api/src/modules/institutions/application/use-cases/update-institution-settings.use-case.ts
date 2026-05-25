import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../ports/institutions.repository';
import { resolveManagedInstitutionId } from './institution-settings-access';

export type UpdateInstitutionSettingsCommand = {
  institutionId?: string;
  allowCashPayments: boolean;
  allowPaypalPayments: boolean;
  allowWalletPayments: boolean;
  termsDocumentUrl?: string | null;
  privacyPolicyUrl?: string | null;
  safetyRulesTitle: string;
  safetyRulesSummary: string;
  safetyRulesBody: string;
};

@Injectable()
export class UpdateInstitutionSettingsUseCase {
  constructor(
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: UpdateInstitutionSettingsCommand) {
    const institutionId = resolveManagedInstitutionId(currentUser, command.institutionId);
    const institution = await this.institutionsRepository.findById(institutionId);

    if (!institution) {
      throw new NotFoundException('La institucion indicada no existe.');
    }

    const normalizedSettings = {
      institutionId,
      allowCashPayments: command.allowCashPayments,
      allowPaypalPayments: command.allowPaypalPayments,
      allowWalletPayments: command.allowWalletPayments,
      termsDocumentUrl: normalizeOptionalUrl(command.termsDocumentUrl),
      privacyPolicyUrl: normalizeOptionalUrl(command.privacyPolicyUrl),
      safetyRulesTitle: command.safetyRulesTitle.trim(),
      safetyRulesSummary: command.safetyRulesSummary.trim(),
      safetyRulesBody: command.safetyRulesBody.trim(),
    };

    const settings = await this.institutionsRepository.updateSettings(normalizedSettings);

    await this.auditService.record({
      actorUserId: currentUser.id,
      institutionId,
      action: AuditAction.InstitutionSettingsUpdated,
      entityType: AuditEntityType.Institution,
      entityId: institutionId,
      metadata: {
        allowCashPayments: settings.allowCashPayments,
        allowPaypalPayments: settings.allowPaypalPayments,
        allowWalletPayments: settings.allowWalletPayments ?? normalizedSettings.allowWalletPayments,
        hasTermsDocumentUrl: Boolean(settings.termsDocumentUrl),
        hasPrivacyPolicyUrl: Boolean(settings.privacyPolicyUrl),
      },
    });

    return {
      message: 'La configuracion institucional fue actualizada correctamente.',
      institution,
      settings,
    };
  }
}

function normalizeOptionalUrl(value?: string | null): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}
