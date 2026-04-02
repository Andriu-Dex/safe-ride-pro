import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  DRIVER_DOCUMENT_STORAGE_SERVICE,
  DriverDocumentStorageService,
} from '../ports/driver-document-storage.service';
import {
  DRIVERS_REPOSITORY,
  DriverDocumentType,
  DriversRepository,
} from '../ports/drivers.repository';

@Injectable()
export class GetDriverApplicationDocumentUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
    @Inject(DRIVER_DOCUMENT_STORAGE_SERVICE)
    private readonly driverDocumentStorageService: DriverDocumentStorageService,
  ) {}

  async execute(
    currentUser: CurrentUserContext,
    membershipId: string,
    documentType: DriverDocumentType,
  ) {
    const membership = await this.driversRepository.findMembershipById(membershipId);

    if (!membership) {
      throw new NotFoundException('La solicitud de conductor no existe.');
    }

    const canAccess =
      currentUser.globalRole === GlobalUserRole.SuperAdmin ||
      membership.userId === currentUser.id ||
      currentUser.memberships.some(
        (item) =>
          item.institutionId === membership.institutionId &&
          item.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(item),
      );

    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a este documento.',
      );
    }

    const driverProfile =
      await this.driversRepository.findDriverProfileByMembershipId(membershipId);

    if (!driverProfile) {
      throw new NotFoundException('La solicitud de conductor aun no ha sido enviada.');
    }

    const fileKey =
      documentType === DriverDocumentType.Identity
        ? driverProfile.identityDocumentFileKey
        : driverProfile.licenseDocumentFileKey;

    if (!fileKey) {
      throw new NotFoundException('El documento solicitado no existe.');
    }

    return this.driverDocumentStorageService.readDocument(fileKey);
  }
}
