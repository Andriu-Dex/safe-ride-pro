import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportRequestDto {
  @IsString()
  @IsNotEmpty()
  tripId!: string;

  @IsString()
  @IsNotEmpty()
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
