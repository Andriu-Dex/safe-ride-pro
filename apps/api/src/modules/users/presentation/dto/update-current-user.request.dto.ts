import { IsOptional, IsString } from 'class-validator';

export class UpdateCurrentUserRequestDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
