import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LiftOperationalSanctionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
