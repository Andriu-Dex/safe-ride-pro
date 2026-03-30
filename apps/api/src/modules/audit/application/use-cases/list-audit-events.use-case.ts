import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { AuditAction, AuditEntityType } from '../../domain/audit.types';
import { AUDIT_REPOSITORY, AuditRepository } from '../ports/audit.repository';

export type ListAuditEventsCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  actorUserId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  from?: string;
  to?: string;
  limit?: number;
};

@Injectable()
export class ListAuditEventsUseCase {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(command: ListAuditEventsCommand) {
    const accessibleInstitutionIds = this.resolveAccessibleInstitutionIds(command.currentUser);

    if (
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      accessibleInstitutionIds.length === 0
    ) {
      throw new ForbiddenException('No tienes permisos para consultar eventos de auditoria.');
    }

    if (
      command.institutionId &&
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds.includes(command.institutionId)
    ) {
      throw new ForbiddenException('No tienes permisos para consultar auditoria de esa institucion.');
    }

    const from = command.from ? new Date(command.from) : undefined;
    const to = command.to ? new Date(command.to) : undefined;

    const items = await this.auditRepository.listEvents({
      institutionIds:
        command.currentUser.globalRole === GlobalUserRole.SuperAdmin
          ? command.institutionId
            ? [command.institutionId]
            : undefined
          : command.institutionId
            ? [command.institutionId]
            : accessibleInstitutionIds,
      actorUserId: command.actorUserId,
      action: command.action,
      entityType: command.entityType,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      limit: command.limit,
    });

    return {
      items,
    };
  }

  private resolveAccessibleInstitutionIds(currentUser: CurrentUserContext): string[] {
    return currentUser.memberships
      .filter(
        (membership) =>
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      )
      .map((membership) => membership.institutionId);
  }
}
