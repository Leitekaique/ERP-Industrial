import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator'

export class CreateProcessDto {
  @IsString()
  tenantId!: string

  @IsString()
  companyId!: string

  @IsOptional()
  empresaId?: string

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  unit!: string

  @IsNumber()
  price!: number

  @IsOptional()
  @IsString()
  artigo?: string

  @IsOptional()
  @IsString()
  forro?: string

  @IsOptional()
  @IsString()
  cola?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
