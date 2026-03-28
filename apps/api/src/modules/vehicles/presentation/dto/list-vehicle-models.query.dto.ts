import { VehicleType } from '@saferidepro/shared-types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListVehicleModelsQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}