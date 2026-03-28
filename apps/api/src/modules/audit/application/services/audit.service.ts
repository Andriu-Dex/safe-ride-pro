import { Inject, Injectable } from '@nestjs/common';

import {
  AUDIT_REPOSITORY,
  AuditRepository,
  CreateAuditEventInput,
} from '../ports/audit.repository';

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async record(input: CreateAuditEventInput): Promise<void> {
    await this.auditRepository.createEvent(input);
  }
}