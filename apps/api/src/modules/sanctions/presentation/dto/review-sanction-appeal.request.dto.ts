import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OperationalSanctionAppealStatus } from '@saferidepro/shared-types';

export class ReviewSanctionAppealRequestDto {
  @IsEnum(OperationalSanctionAppealStatus)
  status!: OperationalSanctionAppealStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
