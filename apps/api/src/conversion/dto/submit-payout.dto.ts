import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitPayoutDto {
  @IsString()
  @IsNotEmpty()
  btcAddress!: string;
}
