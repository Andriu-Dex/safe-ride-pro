import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GetCurrentUserVehiclesUseCase } from '../../../src/modules/vehicles/application/use-cases/get-current-user-vehicles.use-case';
import { GetVehicleRegistrationDocumentUseCase } from '../../../src/modules/vehicles/application/use-cases/get-vehicle-registration-document.use-case';
import { ListLicenseTypesUseCase } from '../../../src/modules/vehicles/application/use-cases/list-license-types.use-case';
import { ListVehicleBrandsUseCase } from '../../../src/modules/vehicles/application/use-cases/list-vehicle-brands.use-case';
import { ListVehicleModelsUseCase } from '../../../src/modules/vehicles/application/use-cases/list-vehicle-models.use-case';
import { RegisterVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/register-vehicle.use-case';
import { SetVehicleActiveStatusUseCase } from '../../../src/modules/vehicles/application/use-cases/set-vehicle-active-status.use-case';
import { UpdateVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/update-vehicle.use-case';
import { UploadVehicleRegistrationDocumentUseCase } from '../../../src/modules/vehicles/application/use-cases/upload-vehicle-registration-document.use-case';
import { VehiclesController } from '../../../src/modules/vehicles/presentation/controllers/vehicles.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('VehiclesController HTTP', () => {
  let app: INestApplication;
  const listLicenseTypesUseCase = { execute: jest.fn() };
  const listVehicleBrandsUseCase = { execute: jest.fn() };
  const listVehicleModelsUseCase = { execute: jest.fn() };
  const getCurrentUserVehiclesUseCase = { execute: jest.fn() };
  const uploadVehicleRegistrationDocumentUseCase = { execute: jest.fn() };
  const getVehicleRegistrationDocumentUseCase = { execute: jest.fn() };
  const registerVehicleUseCase = { execute: jest.fn() };
  const updateVehicleUseCase = { execute: jest.fn() };
  const setVehicleActiveStatusUseCase = { execute: jest.fn() };

  const authenticatedUser: CurrentUserContext = {
    id: 'driver-1',
    email: 'driver@uta.edu.ec',
    fullName: 'Conductor Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-driver',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'DRV001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [VehiclesController],
      providers: [
        { provide: ListLicenseTypesUseCase, useValue: listLicenseTypesUseCase },
        { provide: ListVehicleBrandsUseCase, useValue: listVehicleBrandsUseCase },
        { provide: ListVehicleModelsUseCase, useValue: listVehicleModelsUseCase },
        {
          provide: GetCurrentUserVehiclesUseCase,
          useValue: getCurrentUserVehiclesUseCase,
        },
        {
          provide: UploadVehicleRegistrationDocumentUseCase,
          useValue: uploadVehicleRegistrationDocumentUseCase,
        },
        {
          provide: GetVehicleRegistrationDocumentUseCase,
          useValue: getVehicleRegistrationDocumentUseCase,
        },
        { provide: RegisterVehicleUseCase, useValue: registerVehicleUseCase },
        { provide: UpdateVehicleUseCase, useValue: updateVehicleUseCase },
        {
          provide: SetVehicleActiveStatusUseCase,
          useValue: setVehicleActiveStatusUseCase,
        },
        ...authenticatedHttpContext.guardProviders,
      ],
    });

    app = testApp.app;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedHttpContext.applyAuthenticatedUser();
  });

  it('lists vehicle catalogs and current user vehicles', async () => {
    listLicenseTypesUseCase.execute.mockResolvedValue([{ id: 'A', name: 'Tipo A' }]);
    listVehicleBrandsUseCase.execute.mockResolvedValue([{ id: 'brand-1', name: 'Nissan' }]);
    listVehicleModelsUseCase.execute.mockResolvedValue([{ id: 'model-1', name: 'Sentra' }]);
    getCurrentUserVehiclesUseCase.execute.mockResolvedValue([{ id: 'vehicle-1' }]);

    await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/license-types')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/brands')
      .set('Authorization', 'Bearer test-token')
      .query({ vehicleType: VehicleType.Car })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/vehicles/catalogs/models')
      .set('Authorization', 'Bearer test-token')
      .query({
        brandId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        vehicleType: VehicleType.Car,
      })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/vehicles/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(listVehicleBrandsUseCase.execute).toHaveBeenCalledWith({
      vehicleType: VehicleType.Car,
    });
    expect(listVehicleModelsUseCase.execute).toHaveBeenCalledWith({
      brandId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      vehicleType: VehicleType.Car,
    });
    expect(getCurrentUserVehiclesUseCase.execute).toHaveBeenCalledWith('driver-1');
  });

  it('uploads the vehicle registration document', async () => {
    uploadVehicleRegistrationDocumentUseCase.execute.mockResolvedValue({
      fileKey: 'vehicles/registration.pdf',
    });

    const response = await request(app.getHttpServer())
      .post('/api/vehicles/me/documents/registration')
      .set('Authorization', 'Bearer test-token')
      .attach('file', Buffer.from('pdf-content'), {
        filename: 'matricula.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body).toEqual({
      fileKey: 'vehicles/registration.pdf',
    });
    expect(uploadVehicleRegistrationDocumentUseCase.execute).toHaveBeenCalledWith(
      'driver-1',
      expect.objectContaining({
        originalname: 'matricula.pdf',
        mimetype: 'application/pdf',
      }),
    );
  });

  it('registers and updates a vehicle for the authenticated driver', async () => {
    registerVehicleUseCase.execute.mockResolvedValue({
      id: 'vehicle-1',
    });
    updateVehicleUseCase.execute.mockResolvedValue({
      id: 'vehicle-1',
      color: 'gris',
    });

    await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicleType: VehicleType.Car,
        customBrandName: 'Nissan',
        customModelName: 'Sentra',
        year: 2024,
        color: 'azul',
        plate: 'ABC1234',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
        registrationDocumentFileKey: 'vehicles/registration.pdf',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/api/vehicles/vehicle-1')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicleType: VehicleType.Car,
        customBrandName: 'Nissan',
        customModelName: 'Sentra',
        year: 2024,
        color: 'gris',
        plate: 'ABC1234',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
      })
      .expect(200);

    expect(registerVehicleUseCase.execute).toHaveBeenCalledWith({
      userId: 'driver-1',
      vehicleType: VehicleType.Car,
      brandId: undefined,
      modelId: undefined,
      customBrandName: 'Nissan',
      customModelName: 'Sentra',
      year: 2024,
      color: 'azul',
      plate: 'ABC1234',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: 'vehicles/registration.pdf',
    });
    expect(updateVehicleUseCase.execute).toHaveBeenCalledWith({
      userId: 'driver-1',
      vehicleId: 'vehicle-1',
      vehicleType: VehicleType.Car,
      brandId: undefined,
      modelId: undefined,
      customBrandName: 'Nissan',
      customModelName: 'Sentra',
      year: 2024,
      color: 'gris',
      plate: 'ABC1234',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      registrationDocumentFileKey: undefined,
    });
  });

  it('updates active vehicle status and serves the registration document', async () => {
    setVehicleActiveStatusUseCase.execute.mockResolvedValue({
      id: 'vehicle-1',
      isActive: true,
    });
    getVehicleRegistrationDocumentUseCase.execute.mockResolvedValue({
      fileName: 'matricula.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });

    await request(app.getHttpServer())
      .patch('/api/vehicles/vehicle-1/status')
      .set('Authorization', 'Bearer test-token')
      .send({
        isActive: true,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/vehicles/vehicle-1/documents/registration')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(setVehicleActiveStatusUseCase.execute).toHaveBeenCalledWith({
      userId: 'driver-1',
      vehicleId: 'vehicle-1',
      isActive: true,
    });
    expect(getVehicleRegistrationDocumentUseCase.execute).toHaveBeenCalledWith(
      'driver-1',
      'vehicle-1',
    );
    expect(response.header['content-type']).toContain('application/pdf');
    expect(response.header['content-disposition']).toContain('matricula.pdf');
  });

  it('rejects invalid vehicle payloads before reaching the register use case', async () => {
    await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', 'Bearer test-token')
      .send({
        vehicleType: VehicleType.Car,
        year: 1970,
        color: 'azul',
        plate: 'ABC1234',
        seatCount: 4,
        luggagePolicy: LuggagePolicy.UpToMedium,
      })
      .expect(400);

    expect(registerVehicleUseCase.execute).not.toHaveBeenCalled();
  });
});
