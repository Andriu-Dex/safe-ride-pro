import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { DocumentType } from '@saferidepro/shared-types';

export class RegisterRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^09\d{8}$/, {
    message: 'El celular debe tener 10 digitos y empezar con 09.',
  })
  phone?: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  documentNumber!: string;

  @IsOptional()
  @IsString()
  studentCode?: string;
}
