import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export enum DocTypeDto { CPF='CPF', CNPJ='CNPJ' }

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() tenantId!: string
  @IsString() @IsNotEmpty() companyId!: string

  @IsEnum(DocTypeDto) docType!: DocTypeDto
  @IsString() @IsNotEmpty() document!: string
  @IsString() @IsNotEmpty() name!: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() phone?: string
}