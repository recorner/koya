import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDepositAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  businessContextType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  businessContextRef!: string;

  @IsOptional()
  @IsUUID()
  conversionSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  walletName?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
