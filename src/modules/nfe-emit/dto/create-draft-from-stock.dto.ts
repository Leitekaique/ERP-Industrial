import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export class DraftRecipientDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['CUSTOMER', 'SUPPLIER'])
  tipo!: 'CUSTOMER' | 'SUPPLIER'

  @IsNotEmpty()
  @IsString()
  id!: string
}

export class DraftTransportadoraDto {
  @IsOptional()
  @IsString()
  nome?: string

  @IsOptional()
  @IsString()
  cnpj?: string
}

export class DraftItemDto {
  @IsOptional()
  @IsString()
  productId?: string | null

  @IsNotEmpty()
  @IsString()
  description!: string

  @IsOptional()
  @IsString()
  cfop?: string | null

  @IsOptional()
  @IsString()
  ncm?: string | null

  // ✅ aqui pode vir número; se você mandar pt-BR string, depois a gente ajusta
  @IsNotEmpty()
  qty!: any

  @IsOptional()
  @IsString()
  unit?: string | null

  @IsNotEmpty()
  unitPrice!: any

  @IsOptional()
  taxes?: any

  @IsOptional()
  meta?: any

  // se você manda sku no payload (você manda), pode incluir:
  @IsOptional()
  @IsString()
  sku?: string | null

  @IsOptional()
  @IsString()
  csosn?: string | null
}

export class CreateDraftFromStockDto {
  @IsNotEmpty()
  @IsString()
  tenantId!: string

  @IsNotEmpty()
  @IsString()
  companyId!: string

  @ValidateNested()
  @Type(() => DraftRecipientDto)
  recipient!: DraftRecipientDto

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftItemDto)
  items!: DraftItemDto[]

  @IsOptional()
  @ValidateNested()
  @Type(() => DraftTransportadoraDto)
  transportadora?: DraftTransportadoraDto

  @IsOptional()
  @IsString()
  observacoes?: string
}
