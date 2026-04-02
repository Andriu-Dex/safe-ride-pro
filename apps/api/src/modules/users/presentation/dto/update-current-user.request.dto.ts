import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  USER_CAREER_MIN_LENGTH,
  USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH,
} from '@saferidepro/shared-types';

export class UpdateCurrentUserRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(5, {
    message: 'Ingresa tu nombre completo para continuar.',
  })
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(USER_CAREER_MIN_LENGTH, {
    message: 'Ingresa tu carrera con al menos 3 caracteres.',
  })
  @MaxLength(120, {
    message: 'La carrera no puede superar los 120 caracteres.',
  })
  career?: string;

  @IsOptional()
  @IsString()
  @Matches(/^09\d{8}$/, {
    message: 'El celular debe tener 10 digitos y empezar con 09.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH, {
    message: 'Ingresa tu zona o barrio de referencia.',
  })
  @MaxLength(120, {
    message: 'La zona o barrio de referencia no puede superar los 120 caracteres.',
  })
  referenceNeighborhood?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsUrl(
    { require_protocol: true },
    {
      message: 'La foto de perfil debe ser una URL valida.',
    },
  )
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  @Equals(true, {
    message: 'Debes aceptar los terminos para continuar.',
  })
  acceptTerms?: boolean;

  @IsOptional()
  @IsBoolean()
  @Equals(true, {
    message: 'Debes aceptar la politica de privacidad para continuar.',
  })
  acceptPrivacy?: boolean;

  @IsOptional()
  @IsBoolean()
  @Equals(true, {
    message: 'Debes aceptar las reglas de seguridad para continuar.',
  })
  acceptSafetyRules?: boolean;
}
