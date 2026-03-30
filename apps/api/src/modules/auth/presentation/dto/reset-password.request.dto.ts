import { IsString, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsString()
  code!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
