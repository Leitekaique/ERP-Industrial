import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export enum PaymentMethodDto { pix='pix', card='card', billet='billet', transfer='transfer', cash='cash' }

export class CreatePayableDto {
  @IsString() @IsNotEmpty() tenantId!: string
  @IsString() @IsNotEmpty() companyId!: string
  @IsString() @IsNotEmpty() supplierId!: string

  @IsDateString() dueDate!: string
  @IsNumber() amount!: number
  @IsOptional() @IsEnum(PaymentMethodDto) paymentMethod?: PaymentMethodDto
  @IsOptional() @IsString() nfeReceivedId?: string
}
