import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTripRequestRequestDto {
  @IsUUID()
  tripId!: string;

  @IsOptional()
  @IsLatitude()
  requestedPickupLatitude?: number;

  @IsOptional()
  @IsLongitude()
  requestedPickupLongitude?: number;

  @IsOptional()
  @IsLatitude()
  requestedDropoffLatitude?: number;

  @IsOptional()
  @IsLongitude()
  requestedDropoffLongitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestMessage?: string;
}
