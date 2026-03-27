import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateInstitutionInput,
  InstitutionSummary,
  InstitutionsRepository,
} from '../../application/ports/institutions.repository';

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
    };
  }
}
