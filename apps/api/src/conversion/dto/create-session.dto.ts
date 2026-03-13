import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @IsString()
  @IsNotEmpty()
  channel!: string;
}
