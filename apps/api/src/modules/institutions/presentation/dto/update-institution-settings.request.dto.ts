import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateInstitutionSettingsRequestDto {
  @IsBoolean()
  allowCashPayments!: boolean;

  @IsBoolean()
  allowPaypalPayments!: boolean;

  @IsBoolean()
  allowWalletPayments!: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: 'El enlace de terminos debe ser una URL valida.',
    },
  )
  termsDocumentUrl?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: 'El enlace de privacidad debe ser una URL valida.',
    },
  )
  privacyPolicyUrl?: string;

  @IsString()
  @MaxLength(120)
  safetyRulesTitle!: string;

  @IsString()
  @MaxLength(240)
  safetyRulesSummary!: string;

  @IsString()
  @MaxLength(4000)
  safetyRulesBody!: string;
}
