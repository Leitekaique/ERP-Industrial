import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export enum PaymentMethodDto { pix='pix', card='card', billet='billet', boleto='boleto', transfer='transfer', cash='cash' }

export class CreateReceivableDto {
  @IsString() @IsNotEmpty() tenantId!: string
  @IsString() @IsNotEmpty() companyId!: string
  @IsString() @IsNotEmpty() customerId!: string
  @IsOptional() @IsString() nfeId?: string
  @IsDateString() dueDate!: string
  @IsNumber() amount!: number
  @IsOptional() @IsEnum(PaymentMethodDto) paymentMethod?: PaymentMethodDto
}
