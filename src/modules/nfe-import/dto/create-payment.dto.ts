import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class CreatePayablePaymentDto {
  @IsString() @IsNotEmpty() payableId!: string
  @IsDateString() paidAt!: string
  @IsNumber() amount!: number
  @IsOptional() details?: Record<string, any>
}