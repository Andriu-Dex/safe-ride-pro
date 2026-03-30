import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
  phone?: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  documentNumber!: string;

  @IsOptional()
  @IsString()
  studentCode?: string;
}
