import { IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail, Matches } from 'class-validator'

export class CreateCustomerDto {
  @IsString() @IsNotEmpty()
  tenantId!: string

  @IsString() @IsNotEmpty()
  companyId!: string

  @IsEnum(['CNPJ', 'CPF'] as any)
  docType!: 'CNPJ' | 'CPF'

  @IsString() @IsNotEmpty()
  document!: string

  @IsString() @IsNotEmpty()
  name!: string

  // ---- extras (todos opcionais) ----
  @IsOptional() @IsString()
  ie?: string

  @IsOptional() @IsEmail()
  email?: string

  @IsOptional() @IsString()
  address?: string

  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido. Use 00000-000.' })
  zip?: string
}
