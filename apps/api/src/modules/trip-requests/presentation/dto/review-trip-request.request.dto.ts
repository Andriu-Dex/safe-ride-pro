import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewTripRequestRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
