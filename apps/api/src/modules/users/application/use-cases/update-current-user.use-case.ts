import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  deriveUserOnboardingState,
  isValidEcuadorianMobilePhone,
  USER_CAREER_MIN_LENGTH,
  USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH,
} from '@saferidepro/shared-types';

import {
  UpdateUserProfileInput,
  USERS_REPOSITORY,
  UsersRepository,
} from '../ports/users.repository';

function areDatesEqual(left: Date | null, right: Date | null): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

@Injectable()
export class UpdateCurrentUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string, input: UpdateUserProfileInput & {
    acceptTerms?: boolean;
    acceptPrivacy?: boolean;
    acceptSafetyRules?: boolean;
  }) {
    const currentUser = await this.usersRepository.findById(userId);

    if (!currentUser) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    const normalizedFullName = input.fullName?.trim();
    const normalizedCareer = input.career?.trim();
    const normalizedPhone = input.phone?.trim();
    const normalizedReferenceNeighborhood = input.referenceNeighborhood?.trim();
    const normalizedProfilePhotoUrl = input.profilePhotoUrl?.trim();
    const now = new Date();

    if (normalizedPhone && !isValidEcuadorianMobilePhone(normalizedPhone)) {
      throw new BadRequestException('El celular debe tener 10 digitos y empezar con 09.');
    }

    if (input.fullName !== undefined && !normalizedFullName) {
      throw new BadRequestException('Ingresa tu nombre completo para continuar.');
    }

    if (
      input.career !== undefined &&
      (!normalizedCareer || normalizedCareer.length < USER_CAREER_MIN_LENGTH)
    ) {
      throw new BadRequestException('Ingresa tu carrera con al menos 3 caracteres.');
    }

    if (
      input.referenceNeighborhood !== undefined &&
      (!normalizedReferenceNeighborhood ||
        normalizedReferenceNeighborhood.length < USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH)
    ) {
      throw new BadRequestException('Ingresa tu zona o barrio de referencia.');
    }

    if (input.acceptTerms === false) {
      throw new BadRequestException('Debes aceptar los terminos para continuar.');
    }

    if (input.acceptPrivacy === false) {
      throw new BadRequestException(
        'Debes aceptar la politica de privacidad para continuar.',
      );
    }

    if (input.acceptSafetyRules === false) {
      throw new BadRequestException(
        'Debes aceptar las reglas de seguridad para continuar.',
      );
    }

    const nextTermsAcceptedAt =
      input.acceptTerms ? currentUser.termsAcceptedAt ?? now : currentUser.termsAcceptedAt;
    const nextPrivacyAcceptedAt =
      input.acceptPrivacy ? currentUser.privacyAcceptedAt ?? now : currentUser.privacyAcceptedAt;
    const nextSafetyRulesAcceptedAt = input.acceptSafetyRules
      ? currentUser.safetyRulesAcceptedAt ?? now
      : currentUser.safetyRulesAcceptedAt;

    const onboardingState = deriveUserOnboardingState({
      accountStatus: currentUser.accountStatus,
      emailVerifiedAt: currentUser.emailVerifiedAt,
      career: normalizedCareer ?? currentUser.career,
      referenceNeighborhood:
        normalizedReferenceNeighborhood ?? currentUser.referenceNeighborhood,
      termsAcceptedAt: nextTermsAcceptedAt,
      privacyAcceptedAt: nextPrivacyAcceptedAt,
      safetyRulesAcceptedAt: nextSafetyRulesAcceptedAt,
      onboardingCompletedAt: currentUser.onboardingCompletedAt,
    });

    const nextOnboardingCompletedAt = onboardingState.isComplete
      ? currentUser.onboardingCompletedAt ?? now
      : null;
    const shouldPersistTermsAcceptedAt = !areDatesEqual(
      nextTermsAcceptedAt,
      currentUser.termsAcceptedAt,
    );
    const shouldPersistPrivacyAcceptedAt = !areDatesEqual(
      nextPrivacyAcceptedAt,
      currentUser.privacyAcceptedAt,
    );
    const shouldPersistSafetyRulesAcceptedAt = !areDatesEqual(
      nextSafetyRulesAcceptedAt,
      currentUser.safetyRulesAcceptedAt,
    );
    const shouldPersistOnboardingCompletedAt = !areDatesEqual(
      nextOnboardingCompletedAt,
      currentUser.onboardingCompletedAt,
    );

    return this.usersRepository.updateProfile(userId, {
      fullName: normalizedFullName,
      career: normalizedCareer,
      phone: input.phone !== undefined ? normalizedPhone || null : undefined,
      referenceNeighborhood: normalizedReferenceNeighborhood,
      profilePhotoUrl:
        input.profilePhotoUrl !== undefined
          ? normalizedProfilePhotoUrl || null
          : undefined,
      termsAcceptedAt:
        shouldPersistTermsAcceptedAt && nextTermsAcceptedAt ? nextTermsAcceptedAt : undefined,
      privacyAcceptedAt:
        shouldPersistPrivacyAcceptedAt && nextPrivacyAcceptedAt
          ? nextPrivacyAcceptedAt
          : undefined,
      safetyRulesAcceptedAt:
        shouldPersistSafetyRulesAcceptedAt && nextSafetyRulesAcceptedAt
          ? nextSafetyRulesAcceptedAt
          : undefined,
      onboardingCompletedAt:
        shouldPersistOnboardingCompletedAt ? nextOnboardingCompletedAt : undefined,
    });
  }
}
