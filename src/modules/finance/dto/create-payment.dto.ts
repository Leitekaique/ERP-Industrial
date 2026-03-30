import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreatePaymentDto {
  @IsString() @IsNotEmpty() receivableId!: string
  @IsDateString() paidAt!: string
  @IsNumber() amount!: number
  details?: Record<string, any>
}
