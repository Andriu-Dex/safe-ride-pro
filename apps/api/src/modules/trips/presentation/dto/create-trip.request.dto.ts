import { Type } from 'class-transformer';
import { TripRouteMode } from '@saferidepro/shared-types';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTripRequestDto {
  @IsUUID()
  vehicleId!: string;

  @IsEnum(TripRouteMode)
  routeMode!: TripRouteMode;

  @IsString()
  @MaxLength(120)
  originLabel!: string;

  @IsString()
  @MaxLength(120)
  destinationLabel!: string;

  @Type(() => Number)
  @IsNumber()
  originLatitude!: number;

  @Type(() => Number)
  @IsNumber()
  originLongitude!: number;

  @Type(() => Number)
  @IsNumber()
  destinationLatitude!: number;

  @Type(() => Number)
  @IsNumber()
  destinationLongitude!: number;

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