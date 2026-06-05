import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { AuditRepository } from '../../../src/modules/audit/application/ports/audit.repository';
import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';

function createAuditRepositoryMock(): jest.Mocked<AuditRepository> {
  return {
    createEvent: jest.fn(),
    listEvents: jest.fn(),
  };
}

describe('AuditService', () => {
  it('records audit event by delegating to the audit repository', async () => {
    const repository = createAuditRepositoryMock();
    const service = new AuditService(repository);

    const input = {
      institutionId: 'institution-123',
      actorUserId: 'actor-123',
      action: AuditAction.AuthEmailVerified,
      entityType: AuditEntityType.User,
      entityId: 'entity-123',
      metadata: { key: 'value' },
    };

    await service.record(input);

    expect(repository.createEvent).toHaveBeenCalledWith(input);
  });
});
