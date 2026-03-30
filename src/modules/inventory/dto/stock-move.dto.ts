import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator'

type Ownership = 'own' | 'third_party_in' | 'third_party_out'

export class BaseMoveDto {
  @IsString() tenantId!: string
  @IsString() companyId!: string

  // Propriedade do estoque
  @IsOptional()
  @IsIn(['own', 'third_party_in', 'third_party_out'])
  ownership?: Ownership

  // Quando for consignado em poder da sua empresa (terceiro -> você)
  @ValidateIf(o => o.ownership === 'third_party_in')
  @IsString()
  supplierId?: string

  // Quando for seu material em poder do cliente
  @ValidateIf(o => o.ownership === 'third_party_out')
  @IsString()
  customerId?: string

  @IsOptional()
  @IsString()
  note?: string
}

export class StockInDto extends BaseMoveDto {
  @IsString() warehouseId!: string
  @IsString() productId!: string
  @IsNumber() @Min(0.000001) quantity!: number
}

export class StockOutDto extends BaseMoveDto {
  @IsString() warehouseId!: string
  @IsString() productId!: string
  @IsNumber() @Min(0.000001) quantity!: number

  // Quando true: cria Receivable com preço × quantidade respeitando billingTerms do cliente
  @IsOptional()
  generateCharge?: boolean
}

export class StockTransferDto extends BaseMoveDto {
  @IsString() fromWarehouseId!: string
  @IsString() toWarehouseId!: string
  @IsString() productId!: string
  @IsNumber() @Min(0.000001) quantity!: number
}
