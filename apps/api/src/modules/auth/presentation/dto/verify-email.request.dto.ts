import { IsString } from 'class-validator';

export class VerifyEmailRequestDto {
  @IsString()
  code!: string;
}
