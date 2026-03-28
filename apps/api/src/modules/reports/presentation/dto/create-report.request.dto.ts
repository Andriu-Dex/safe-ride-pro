import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportRequestDto {
  @IsUUID()
  tripId!: string;

  @IsUUID()
  reportedMembershipId!: string;

  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  evidenceFileKey?: string;
}