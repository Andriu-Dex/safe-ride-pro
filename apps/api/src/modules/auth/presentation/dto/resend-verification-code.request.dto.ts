import { IsEmail } from 'class-validator';

export class ResendVerificationCodeRequestDto {
  @IsEmail()
  email!: string;
}
