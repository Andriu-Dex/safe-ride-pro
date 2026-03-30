import { IsString } from 'class-validator';

export class RefreshSessionRequestDto {
  @IsString()
  refreshToken!: string;
}
