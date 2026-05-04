import { IsEnum } from 'class-validator';
import { AccountStatus } from '@saferidepro/shared-types';

export class UpdateAdminUserAccountStatusRequestDto {
  @IsEnum(AccountStatus)
  accountStatus!: AccountStatus;
}
