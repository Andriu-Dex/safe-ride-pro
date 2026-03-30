import {
  isOperationalMembership,
  MembershipStatus,
  selectOperationalMembership,
} from '@saferidepro/shared-types';

import type { AuthMembership } from '../types/auth-session';

export type OperationalAccessState = {
  selectedMembership?: AuthMembership;
  operationalMembership?: AuthMembership;
  hasOperationalMembership: boolean;
  title: string | null;
  message: string | null;
};

export function getOperationalAccessState(
  memberships: readonly AuthMembership[] | null | undefined,
): OperationalAccessState {
  const selectedMembership = selectOperationalMembership(memberships);
  const operationalMembership =
    selectedMembership && isOperationalMembership(selectedMembership)
      ? selectedMembership
      : undefined;

  if (operationalMembership) {
    return {
      selectedMembership,
      operationalMembership,
      hasOperationalMembership: true,
      title: null,
      message: null,
    };
  }

  if (!memberships?.length) {
    return {
      selectedMembership,
      operationalMembership,
      hasOperationalMembership: false,
      title: 'Sin membresia institucional',
      message:
        'Tu cuenta todavia no tiene una membresia institucional asociada. Necesitas una membresia activa en una institucion operativa para usar los modulos de conductor, vehiculos, viajes y confianza.',
    };
  }

  const hasActiveMembership = memberships.some(
    (membership) => membership.membershipStatus === MembershipStatus.Active,
  );
  const hasActiveInstitution = memberships.some(
    (membership) => membership.institutionIsActive !== false,
  );

  if (!hasActiveMembership) {
    return {
      selectedMembership,
      operationalMembership,
      hasOperationalMembership: false,
      title: 'Membresia inactiva',
      message:
        'Tu sesion no tiene una membresia activa disponible para operar en SafeRidePro. Debes esperar la reactivacion administrativa o ingresar con otra cuenta habilitada.',
    };
  }

  if (!hasActiveInstitution) {
    return {
      selectedMembership,
      operationalMembership,
      hasOperationalMembership: false,
      title: 'Institucion no operativa',
      message:
        'Tus instituciones asociadas no se encuentran operativas en este momento. Debes esperar la reactivacion institucional o usar otra membresia activa dentro de una institucion habilitada.',
    };
  }

  return {
    selectedMembership,
    operationalMembership,
    hasOperationalMembership: false,
    title: 'Contexto operativo no disponible',
    message:
      'No fue posible determinar una membresia operativa para continuar. Refresca la sesion o contacta con soporte institucional si el problema persiste.',
  };
}
