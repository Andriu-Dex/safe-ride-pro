import { UserOnboardingRequirement } from '@saferidepro/shared-types';

export function getOnboardingRequirementLabel(
  requirement: UserOnboardingRequirement,
): string {
  switch (requirement) {
    case UserOnboardingRequirement.EmailVerification:
      return 'Verificar el correo institucional';
    case UserOnboardingRequirement.Career:
      return 'Indicar tu carrera';
    case UserOnboardingRequirement.ReferenceNeighborhood:
      return 'Indicar tu zona o barrio de referencia';
    case UserOnboardingRequirement.Terms:
      return 'Aceptar los terminos';
    case UserOnboardingRequirement.Privacy:
      return 'Aceptar la politica de privacidad';
    case UserOnboardingRequirement.SafetyRules:
      return 'Aceptar las reglas de seguridad';
    default:
      return requirement;
  }
}
