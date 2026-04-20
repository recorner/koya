import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Channel } from '@koya/types';

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
  @IsEnum(Channel)
  channel!: string;
}
