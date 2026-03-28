import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ReportStatus } from '@saferidepro/shared-types';

export class ListReviewableReportsQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : Number.parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
