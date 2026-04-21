import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteTripRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closureNote?: string;
}
