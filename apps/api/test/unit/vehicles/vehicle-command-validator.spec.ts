import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import {
  assertVehicleManagementAllowed,
  validateAndNormalizeVehicleCommand,
  MAX_SEAT_COUNT_BY_VEHICLE_TYPE,
} from '../../../src/modules/vehicles/application/services/vehicle-command-validator';
import type { VehiclesRepository } from '../../../src/modules/vehicles/application/ports/vehicles.repository';

function createVehiclesRepositoryMock(): jest.Mocked<VehiclesRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    listLicenseTypes: jest.fn(),
    listVehicleBrands: jest.fn(),
    listVehicleModels: jest.fn(),
    findVehicleBrandById: jest.fn(),
    findVehicleModelById: jest.fn(),
    findVehicleByPlate: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    findVehiclesByMembershipId: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    updateVehicleStatus: jest.fn(),
  };
}

describe('vehicle-command-validator', () => {
  describe('assertVehicleManagementAllowed', () => {
    it('throws ForbiddenException if membership is null', async () => {
      await expect(assertVehicleManagementAllowed(null)).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para gestionar vehiculos.'),
      );
    });

    it('throws ForbiddenException if membership status is not active', async () => {
      await expect(
        assertVehicleManagementAllowed({
          id: 'memb-1',
          membershipStatus: MembershipStatus.Inactive,
          driverVerificationStatus: DriverVerificationStatus.Approved,
        } as any),
      ).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para gestionar vehiculos.'),
      );
    });

    it('throws ForbiddenException if driver verification status is not requested/approved', async () => {
      await expect(
        assertVehicleManagementAllowed({
          id: 'memb-1',
          membershipStatus: MembershipStatus.Active,
          driverVerificationStatus: DriverVerificationStatus.NotRequested,
        } as any),
      ).rejects.toThrow(
        new ForbiddenException(
          'Debes haber iniciado o aprobado tu proceso de conductor para gestionar vehiculos.',
        ),
      );
    });

    it('throws ForbiddenException if driver verification is approved but license status is expired', async () => {
      await expect(
        assertVehicleManagementAllowed({
          id: 'memb-1',
          membershipStatus: MembershipStatus.Active,
          driverVerificationStatus: DriverVerificationStatus.Approved,
          licenseStatus: DriverLicenseStatus.Expired,
        } as any),
      ).rejects.toThrow(
        new ForbiddenException(
          'Tu licencia vencio. Debes actualizarla antes de gestionar vehiculos.',
        ),
      );
    });

    it('returns membership if verification status is approved and license is active', async () => {
      const membership = {
        id: 'memb-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
        licenseStatus: DriverLicenseStatus.Valid,
      } as any;
      const result = await assertVehicleManagementAllowed(membership);
      expect(result).toBe(membership);
    });

    it('returns membership if verification status is pending verification', async () => {
      const membership = {
        id: 'memb-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      } as any;
      const result = await assertVehicleManagementAllowed(membership);
      expect(result).toBe(membership);
    });
  });

  describe('validateAndNormalizeVehicleCommand', () => {
    let repository: jest.Mocked<VehiclesRepository>;

    beforeEach(() => {
      repository = createVehiclesRepositoryMock();
    });

    it('throws BadRequestException if year is less than 1980', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 1979,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('El anio del vehiculo no es valido.'),
      );
    });

    it('throws BadRequestException if year is too far in the future', async () => {
      const futureYear = new Date().getFullYear() + 2;
      const command = {
        vehicleType: VehicleType.Car,
        year: futureYear,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('El anio del vehiculo no es valido.'),
      );
    });

    it('throws BadRequestException if seatCount is less than 1', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 0,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException(
          'La capacidad permitida para este tipo de vehiculo es de 1 a 4 pasajeros.',
        ),
      );
    });

    it('throws BadRequestException if seatCount exceeds max limit for type', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 5,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException(
          'La capacidad permitida para este tipo de vehiculo es de 1 a 4 pasajeros.',
        ),
      );
    });

    it('throws BadRequestException if motorcycle has seatCount other than 1', async () => {
      const command = {
        vehicleType: VehicleType.Motorcycle,
        year: 2020,
        seatCount: 2,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      const originalMax = MAX_SEAT_COUNT_BY_VEHICLE_TYPE[VehicleType.Motorcycle];
      (MAX_SEAT_COUNT_BY_VEHICLE_TYPE as any)[VehicleType.Motorcycle] = 2;

      try {
        await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
          new BadRequestException('Las motocicletas solo pueden registrarse con 1 pasajero.'),
        );
      } finally {
        (MAX_SEAT_COUNT_BY_VEHICLE_TYPE as any)[VehicleType.Motorcycle] = originalMax;
      }
    });

    it('throws BadRequestException if both brandId and customBrandName are provided', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
        customBrandName: 'Toyota',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException(
          'Debes elegir una marca del catalogo o ingresar una marca manual, no ambas.',
        ),
      );
    });

    it('throws BadRequestException if neither brandId nor customBrandName is provided', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('Debes seleccionar una marca o ingresar una marca manual.'),
      );
    });

    it('throws BadRequestException if both modelId and customModelName are provided', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
        modelId: 'model-1',
        customModelName: 'Yaris',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException(
          'Debes elegir un modelo del catalogo o ingresar un modelo manual, no ambos.',
        ),
      );
    });

    it('throws BadRequestException if neither modelId nor customModelName is provided', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('Debes seleccionar un modelo o ingresar un modelo manual.'),
      );
    });

    it('throws BadRequestException if registrationDocumentFileKey is missing', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
        modelId: 'model-1',
        registrationDocumentFileKey: ' ',
      } as any;
      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('Debes cargar el documento de matricula del vehiculo.'),
      );
    });

    it('throws BadRequestException if brandId is not found', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
        customModelName: 'Yaris',
        registrationDocumentFileKey: 'file-123',
      } as any;
      repository.findVehicleBrandById.mockResolvedValue(null);

      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('La marca seleccionada no existe o no se encuentra activa.'),
      );
    });

    it('throws BadRequestException if modelId is not found', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        customBrandName: 'Toyota',
        modelId: 'model-1',
        registrationDocumentFileKey: 'file-123',
      } as any;
      repository.findVehicleModelById.mockResolvedValue(null);

      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('El modelo seleccionado no existe o no se encuentra activo.'),
      );
    });

    it('throws BadRequestException if model brandId does not match command brandId', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'ABC-123',
        color: 'Rojo',
        brandId: 'brand-1',
        modelId: 'model-1',
        registrationDocumentFileKey: 'file-123',
      } as any;
      repository.findVehicleBrandById.mockResolvedValue({ id: 'brand-1', name: 'Toyota' });
      repository.findVehicleModelById.mockResolvedValue({
        id: 'model-1',
        brandId: 'brand-different',
        brandName: 'Honda',
        name: 'Civic',
        vehicleType: VehicleType.Car,
        isActive: true,
      });

      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('El modelo seleccionado no pertenece a la marca indicada.'),
      );
    });

    it('throws BadRequestException if model vehicleType does not match command vehicleType', async () => {
      const command = {
        vehicleType: VehicleType.Motorcycle,
        year: 2020,
        seatCount: 1,
        plate: 'ABC-123',
        color: 'Rojo',
        customBrandName: 'Honda',
        modelId: 'model-1',
        registrationDocumentFileKey: 'file-123',
      } as any;
      repository.findVehicleModelById.mockResolvedValue({
        id: 'model-1',
        brandId: 'brand-1',
        brandName: 'Honda',
        name: 'Civic',
        vehicleType: VehicleType.Car,
        isActive: true,
      });

      await expect(validateAndNormalizeVehicleCommand(repository, 'memb-1', command)).rejects.toThrow(
        new BadRequestException('El modelo seleccionado no corresponde al tipo de vehiculo elegido.'),
      );
    });

    it('throws BadRequestException if plate is registered to another vehicle', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'abc-123',
        color: 'Rojo',
        customBrandName: 'Toyota',
        customModelName: 'Yaris',
        registrationDocumentFileKey: 'file-123',
      } as any;
      repository.findVehicleByPlate.mockResolvedValue({
        id: 'vehicle-other',
      } as any);

      await expect(
        validateAndNormalizeVehicleCommand(repository, 'memb-1', command, 'vehicle-current'),
      ).rejects.toThrow(new BadRequestException('La placa ingresada ya esta registrada en el sistema.'));
    });

    it('succeeds and normalizes fields for creation command', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: '   abc-123   ',
        color: '  Rojo  ',
        customBrandName: '  Toyota  ',
        customModelName: '  Yaris  ',
        registrationDocumentFileKey: '   file-123   ',
        luggagePolicy: 'up_to_medium',
      } as any;
      repository.findVehicleByPlate.mockResolvedValue(null);

      const result = await validateAndNormalizeVehicleCommand(repository, 'memb-1', command);

      expect(result).toEqual({
        membershipId: 'memb-1',
        vehicleType: VehicleType.Car,
        brandId: undefined,
        modelId: undefined,
        customBrandName: 'Toyota',
        customModelName: 'Yaris',
        year: 2020,
        color: 'Rojo',
        plate: 'ABC-123',
        seatCount: 4,
        luggagePolicy: 'up_to_medium',
        registrationDocumentFileKey: 'file-123',
      });
    });

    it('succeeds and normalizes fields for update command', async () => {
      const command = {
        vehicleType: VehicleType.Car,
        year: 2020,
        seatCount: 4,
        plate: 'abc-123',
        color: 'Rojo',
        customBrandName: 'Toyota',
        customModelName: 'Yaris',
        registrationDocumentFileKey: 'file-123',
        luggagePolicy: 'up_to_medium',
      } as any;
      repository.findVehicleByPlate.mockResolvedValue({
        id: 'vehicle-current',
      } as any);

      const result = await validateAndNormalizeVehicleCommand(
        repository,
        'memb-1',
        command,
        'vehicle-current',
      );

      expect(result).toEqual({
        vehicleId: 'vehicle-current',
        membershipId: 'memb-1',
        vehicleType: VehicleType.Car,
        brandId: undefined,
        modelId: undefined,
        customBrandName: 'Toyota',
        customModelName: 'Yaris',
        year: 2020,
        color: 'Rojo',
        plate: 'ABC-123',
        seatCount: 4,
        luggagePolicy: 'up_to_medium',
        registrationDocumentFileKey: 'file-123',
      });
    });
  });
});
