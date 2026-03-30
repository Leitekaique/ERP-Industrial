import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator'

export enum DocTypeDto {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

export class CreateSupplierDto {
  @IsString()
  tenantId!: string

  @IsString()
  companyId!: string

  @IsEnum(DocTypeDto)
  docType!: DocTypeDto

  @IsString()
  document!: string

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  ie?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  number?: string

  @IsOptional()
  @IsString()
  complement?: string

  @IsOptional()
  @IsString()
  neighborhood?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  state?: string

  @IsOptional()
  @IsString()
  zip?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string
}

export class UpdateSupplierDto extends CreateSupplierDto {}
