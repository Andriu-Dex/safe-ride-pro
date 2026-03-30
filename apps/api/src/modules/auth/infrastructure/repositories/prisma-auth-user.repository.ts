import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  DocumentType,
  DriverVerificationStatus,
  GlobalUserRole,
  MembershipRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import {
  AccountStatus as SharedAccountStatus,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  DriverVerificationStatus as SharedDriverVerificationStatus,
  GlobalUserRole as SharedGlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus as SharedMembershipStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  AuthUserRecord,
  AuthUserDocumentConflictError,
  AuthUserRepository,
  CreateUserWithMembershipInput,
  EmailVerificationRecord,
  PasswordResetRecord,
  RefreshTokenSessionRecord,
  ResolvedInstitution,
} from '../../application/ports/auth-user.repository';

@Injectable()
export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildAuthUserInclude(): Prisma.UserInclude {
    return {
      memberships: {
        include: {
          institution: true,
          driverProfile: {
            select: {
              licenseExpiresAt: true,
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
      },
    };
  }

  async findInstitutionByDomain(domain: string): Promise<ResolvedInstitution | null> {
    const institutionDomain = await this.prisma.institutionDomain.findFirst({
      where: {
        domain,
        isActive: true,
        institution: {
          isActive: true,
        },
      },
      include: {
        institution: true,
      },
    });

    if (!institutionDomain) {
      return null;
    }

    return {
      id: institutionDomain.institution.id,
      name: institutionDomain.institution.name,
      code: institutionDomain.institution.code,
    };
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.buildAuthUserInclude(),
    });

    return user ? this.mapUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.buildAuthUserInclude(),
    });

    return user ? this.mapUser(user) : null;
  }

  async createUserWithMembership(input: CreateUserWithMembershipInput): Promise<AuthUserRecord> {
    const studentCode = await this.resolveStudentCode(input.institutionId, input.email, input.studentCode);
    try {
      const createdUser = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          documentType: input.documentType as DocumentType,
          documentNumber: input.documentNumber,
          globalRole: GlobalUserRole.USER,
          accountStatus: AccountStatus.PENDING_EMAIL_VERIFICATION,
          memberships: {
            create: {
              institutionId: input.institutionId,
              role: MembershipRole.STUDENT,
              membershipStatus: MembershipStatus.ACTIVE,
              studentCode,
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NOT_REQUESTED,
            },
          },
        },
        include: this.buildAuthUserInclude(),
      });

      return this.mapUser(createdUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [];

        if (
          error.code === 'P2002' &&
          target.includes('documentType') &&
          target.includes('documentNumber')
        ) {
          throw new AuthUserDocumentConflictError();
        }
      }

      throw error;
    }
  }

  private async resolveStudentCode(
    institutionId: string,
    email: string,
    requestedStudentCode?: string,
  ): Promise<string> {
    const preferredCode =
      requestedStudentCode?.trim() || this.buildStudentCodeCandidateFromEmail(email);
    let candidate = preferredCode;
    let suffix = 2;

    while (
      await this.prisma.userInstitutionMembership.findFirst({
        where: {
          institutionId,
          studentCode: candidate,
        },
        select: {
          id: true,
        },
      })
    ) {
      candidate = `${preferredCode}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private buildStudentCodeCandidateFromEmail(email: string): string {
    const localPart = email.split('@')[0] ?? 'ESTUDIANTE';
    const normalizedBase = localPart
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();

    return normalizedBase || 'ESTUDIANTE';
  }

  async createEmailVerificationCode(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.emailVerificationCode.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidEmailVerification(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null> {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: {
        tokenHash,
        verifiedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
    };
  }

  async findLatestPendingEmailVerificationByUserId(
    userId: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null> {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        verifiedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
    };
  }

  async markEmailAsVerified(
    userId: string,
    tokenId: string,
    verifiedAt: Date,
  ): Promise<AuthUserRecord> {
    const [, updatedUser] = await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({
        where: { id: tokenId },
        data: { verifiedAt },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: verifiedAt,
          accountStatus: AccountStatus.ACTIVE,
        },
        include: this.buildAuthUserInclude(),
      }),
    ]);

    return this.mapUser(updatedUser);
  }

  async createPasswordResetCode(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.passwordResetCode.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findLatestPendingPasswordResetByUserId(
    userId: string,
    now: Date,
  ): Promise<PasswordResetRecord | null> {
    const record = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    };
  }

  async findValidPasswordResetCode(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetRecord | null> {
    const record = await this.prisma.passwordResetCode.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    };
  }

  async markPasswordResetCodeAsUsed(tokenId: string, usedAt: Date): Promise<void> {
    await this.prisma.passwordResetCode.update({
      where: { id: tokenId },
      data: { usedAt },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });
  }

  async createRefreshTokenSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshTokenSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidRefreshTokenSession(
    tokenHash: string,
    now: Date,
  ): Promise<RefreshTokenSessionRecord | null> {
    const session = await this.prisma.refreshTokenSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
    };
  }

  async revokeRefreshTokenSession(tokenId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshTokenSession.update({
      where: { id: tokenId },
      data: {
        revokedAt,
        lastUsedAt: revokedAt,
      },
    });
  }

  async revokeAllRefreshTokenSessionsForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshTokenSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt,
        lastUsedAt: revokedAt,
      },
    });
  }

  private mapUser(user: any): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      globalRole: user.globalRole as unknown as SharedGlobalUserRole,
      accountStatus: user.accountStatus as unknown as SharedAccountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      memberships: user.memberships.map((membership: any) => ({
        id: membership.id,
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
        institutionIsActive: membership.institution.isActive,
        role: membership.role as unknown as InstitutionMembershipRole,
        membershipStatus: membership.membershipStatus as unknown as SharedMembershipStatus,
        studentCode: membership.studentCode,
        isDefault: membership.isDefault,
        driverVerificationStatus:
          membership.driverVerificationStatus as unknown as SharedDriverVerificationStatus,
        effectiveDriverVerificationStatus: getEffectiveDriverVerificationStatus(
          membership.driverVerificationStatus as unknown as SharedDriverVerificationStatus,
          membership.driverProfile?.licenseExpiresAt ?? null,
        ) as SharedDriverVerificationStatus,
        licenseExpiresAt: membership.driverProfile?.licenseExpiresAt ?? null,
        licenseStatus: getDriverLicenseStatus(membership.driverProfile?.licenseExpiresAt ?? null),
        licenseExpiresInDays: getDaysUntilDriverLicenseExpiration(
          membership.driverProfile?.licenseExpiresAt ?? null,
        ),
      })),
    };
  }
}
