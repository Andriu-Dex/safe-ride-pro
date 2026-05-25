import { Type } from 'class-transformer';
import { TripRouteMode } from '@saferidepro/shared-types';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

class TripRoutePathPointDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class UpdateTripRequestDto {
  @IsString()
  @IsNotEmpty()
  vehicleId!: string;

  @IsEnum(TripRouteMode)
  routeMode!: TripRouteMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  originLabel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destinationLabel!: string;

  @Type(() => Number)
  @IsLatitude()
  originLatitude!: number;

  @Type(() => Number)
  @IsLongitude()
  originLongitude!: number;

  @Type(() => Number)
  @IsLatitude()
  destinationLatitude!: number;

  @Type(() => Number)
  @IsLongitude()
  destinationLongitude!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripRoutePathPointDto)
  routePath?: TripRoutePathPointDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeDurationSeconds?: number;

  @IsDateString()
  departureAt!: string;

  @IsDateString()
  estimatedArrivalAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceReference!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  detourSurchargeReference?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
