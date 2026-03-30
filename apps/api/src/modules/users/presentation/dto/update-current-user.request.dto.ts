import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateCurrentUserRequestDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^09\d{8}$/, {
    message: 'El celular debe tener 10 digitos y empezar con 09.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
