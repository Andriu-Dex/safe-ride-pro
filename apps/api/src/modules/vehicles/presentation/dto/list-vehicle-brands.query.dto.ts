import { VehicleType } from '@saferidepro/shared-types';
import { IsEnum, IsOptional } from 'class-validator';

export class ListVehicleBrandsQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}
