import { Transform } from 'class-transformer';
import {
  TripAvailabilityFilter,
  TripRouteMode,
  TRIP_TIME_FILTER_PATTERN,
  VehicleType,
} from '@saferidepro/shared-types';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ListTripsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
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
  @Matches(TRIP_TIME_FILTER_PATTERN)
  timeFrom?: string;

  @IsOptional()
  @Matches(TRIP_TIME_FILTER_PATTERN)
  timeTo?: string;

  @IsOptional()
  @IsEnum(TripRouteMode)
  routeMode?: TripRouteMode;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsEnum(TripAvailabilityFilter)
  availability?: TripAvailabilityFilter;
}
