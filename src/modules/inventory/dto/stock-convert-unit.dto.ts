// modules/inventory/dto/stock-convert-unit.dto.ts
import { IsNumber, IsString, Min } from 'class-validator'

export class StockConvertUnitDto {
  @IsString()
  tenantId!: string

  @IsString()
  companyId!: string

  @IsString()
  productId!: string

  @IsString()
  warehouseId!: string

  @IsNumber()
  @Min(0.000001)
  quantity!: number

  @IsNumber()
  @Min(0.000001)
  factor!: number
  
  @IsString()
  unitDestino!: string

  @IsString()
  empresaDestinoId!: string

  note?: string
}
