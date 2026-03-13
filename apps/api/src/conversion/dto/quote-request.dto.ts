import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class QuoteRequestDto {
  @IsString()
  @IsNotEmpty()
  sourceAsset!: string;

  @IsString()
  @IsNotEmpty()
  targetAsset!: string;

  @IsString()
  @IsNotEmpty()
  sourceAmount!: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['WEB', 'WHATSAPP'])
  channel!: string;
}
