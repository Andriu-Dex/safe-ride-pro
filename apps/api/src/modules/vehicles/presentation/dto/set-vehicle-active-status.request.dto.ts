import { IsBoolean } from 'class-validator';

export class SetVehicleActiveStatusRequestDto {
  @IsBoolean()
  isActive!: boolean;
}
