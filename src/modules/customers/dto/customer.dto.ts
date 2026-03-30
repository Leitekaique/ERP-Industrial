import { IsString, IsOptional, IsEmail, IsEnum, IsInt, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { PartialType } from '@nestjs/mapped-types'

const toStringOrUndefined = ({ value }: { value: any }) =>
  value === '' || value === null ? undefined : value

export enum DocTypeDto {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

export class CreateCustomerDto {
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
  district?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  cityCode?: string

  @IsOptional()
  @IsString()
  state?: string

  @IsOptional()
  @IsString()
  zip?: string

  @IsOptional()
  @Transform(toStringOrUndefined)
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @Transform(toStringOrUndefined)
  @IsEmail()
  emailFinanceiro?: string

  @IsOptional()
  @Transform(toStringOrUndefined)
  @IsEmail()
  emailAdicional1?: string

  @IsOptional()
  @Transform(toStringOrUndefined)
  @IsEmail()
  emailAdicional2?: string

  // ── Financeiro ──────────────────────────────────────────
  // Dia do mês em que a duplicata vence (ex: 10 = todo dia 10 do mês seguinte)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  paymentTermDay?: number

  // E-mail do contador — recebe cópia de todas as notificações de cobrança
  @IsOptional()
  @Transform(toStringOrUndefined)
  @IsEmail()
  accountantEmail?: string

  @IsOptional()
  @IsString()
  billingTerms?: string
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
