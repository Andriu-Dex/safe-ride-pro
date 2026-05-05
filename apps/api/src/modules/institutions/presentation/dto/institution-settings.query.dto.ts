import { IsOptional, IsUUID } from 'class-validator';

export class InstitutionSettingsQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
