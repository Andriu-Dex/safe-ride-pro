import { LuggagePolicy, VehicleType } from '@saferidepro/shared-types';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterVehicleRequestDto {
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customBrandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customModelName?: string;

  @IsInt()
  @Min(1980)
  @Max(2100)
  year!: number;

  @IsString()
  @MaxLength(60)
  color!: string;

  @IsString()
  @MaxLength(20)
  plate!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  seatCount!: number;

  @IsEnum(LuggagePolicy)
  luggagePolicy!: LuggagePolicy;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  registrationDocumentFileKey?: string;
}