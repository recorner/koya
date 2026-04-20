import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Channel } from '@koya/types';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(Channel)
  channel!: string;
}
