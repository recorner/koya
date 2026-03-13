import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ConfirmReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  mpesaReference!: string;
}
