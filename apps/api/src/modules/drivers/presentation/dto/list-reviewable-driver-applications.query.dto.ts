import { DriverVerificationStatus } from '@saferidepro/shared-types';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListReviewableDriverApplicationsQueryDto {
  @IsOptional()
  @IsString()
  institutionId?: string;

  @IsOptional()
  @IsEnum(DriverVerificationStatus)
  status?: DriverVerificationStatus;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
