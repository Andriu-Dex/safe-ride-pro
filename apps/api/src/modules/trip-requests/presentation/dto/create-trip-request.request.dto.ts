import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTripRequestRequestDto {
  @IsUUID()
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
}
