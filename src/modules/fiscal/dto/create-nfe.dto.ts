import { Type } from 'class-transformer'
import { ValidateNested, IsString, IsOptional, IsEnum, IsEmail, IsNotEmpty, IsArray } from 'class-validator'
import { NfeItemDto } from './nfe-item.dto'

export enum DocTypeDto { CPF='CPF', CNPJ='CNPJ' }

class InlineCustomerDto {
  @IsEnum(DocTypeDto) doc_type!: DocTypeDto
  @IsString() @IsNotEmpty() document!: string
  @IsString() @IsNotEmpty() name!: string
  @IsOptional() @IsEmail() email?: string
}

export class CreateNfeDto {
  @IsString() @IsNotEmpty() tenantId!: string
  @IsString() @IsNotEmpty() company_id!: string

  @IsOptional() @IsString() customer_id?: string
  @IsOptional() @ValidateNested() @Type(() => InlineCustomerDto) customer?: InlineCustomerDto

  @IsArray() @ValidateNested({ each: true }) @Type(() => NfeItemDto)
  items!: NfeItemDto[]

  @IsOptional() additional_info?: string
}
