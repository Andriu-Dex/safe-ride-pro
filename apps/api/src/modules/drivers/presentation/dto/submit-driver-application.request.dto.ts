import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitDriverApplicationRequestDto {
  @IsUUID()
  licenseTypeId!: string;

  @IsString()
  @MaxLength(30)
  licenseNumber!: string;

  @IsDateString()
  licenseExpiresAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  identityDocumentFileKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  licenseDocumentFileKey?: string;
}