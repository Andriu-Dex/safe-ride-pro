import { Type } from 'class-transformer';
import { TripRouteMode, VehicleType } from '@saferidepro/shared-types';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListTripsQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(TripRouteMode)
  routeMode?: TripRouteMode;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}