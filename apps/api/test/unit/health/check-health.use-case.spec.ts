import { CheckHealthUseCase } from '../../../src/modules/health/application/use-cases/check-health.use-case';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

function createPrismaServiceMock(): jest.Mocked<PrismaService> {
  const mock = Object.create(PrismaService.prototype) as jest.Mocked<PrismaService>;
  mock.$queryRawUnsafe = jest.fn();
  return mock;
}

describe('CheckHealthUseCase', () => {
  it('performs DB connectivity check and returns API health indicators', async () => {
    const prismaMock = createPrismaServiceMock();
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ '1': 1 }]);

    const useCase = new CheckHealthUseCase(prismaMock);
    const result = await useCase.execute();

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(result).toEqual({
      status: 'ok',
      service: 'api',
      database: {
        status: 'ok',
      },
      timestamp: expect.any(String),
      uptimeSeconds: expect.any(Number),
    });

    // Verify timestamp format and uptime validity
    expect(Date.parse(result.timestamp)).not.toBeNaN();
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
