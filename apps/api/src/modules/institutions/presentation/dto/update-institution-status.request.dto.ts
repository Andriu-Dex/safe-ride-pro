import { IsBoolean } from 'class-validator';

export class UpdateInstitutionStatusRequestDto {
  @IsBoolean()
  isActive!: boolean;
}
