import { Type } from 'class-transformer';
import { PaymentProvider } from '@saferidepro/shared-types';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTripRequestRequestDto {
  @IsString()
  @MaxLength(120)
  tripId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  requestedPickupLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  requestedPickupLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  requestedDropoffLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  requestedDropoffLongitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestMessage?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsBoolean()
  acceptReservationCommitment!: boolean;
}
