import { IsOptional, IsString } from 'class-validator';

export class InstitutionSettingsQueryDto {
  @IsOptional()
  @IsString()
  institutionId?: string;
}
