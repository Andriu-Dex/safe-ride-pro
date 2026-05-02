import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReportCashPaymentIssueRequestDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  note!: string;
}
