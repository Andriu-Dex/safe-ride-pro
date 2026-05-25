import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class CreateWalletTopUpRequestDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(200)
  amount!: number;
}
