import { DriverVerificationStatus } from '@saferidepro/shared-types';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDriverApplicationRequestDto {
  @IsIn([DriverVerificationStatus.Approved, DriverVerificationStatus.Rejected])
  decision!: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;
}