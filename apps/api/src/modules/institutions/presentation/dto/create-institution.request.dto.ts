import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CreateInstitutionRequestDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  domains!: string[];
}
