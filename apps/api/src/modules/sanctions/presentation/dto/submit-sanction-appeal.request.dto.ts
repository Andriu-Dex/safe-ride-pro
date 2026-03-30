import { IsString, MaxLength } from 'class-validator';

export class SubmitSanctionAppealRequestDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
