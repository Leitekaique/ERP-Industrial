// modules/inventory/dto/stock-convert-unit.dto.ts
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

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

  // factor e largura são mutuamente exclusivos; validação real feita no service
  @IsOptional()
  factor?: number

  @IsOptional()
  largura?: number

  @IsString()
  unitDestino!: string

  @IsString()
  empresaDestinoId!: string

  @IsOptional()
  @IsString()
  empresaOrigemId?: string

  // Lote específico (botão "Converter" na linha do lote)
  @IsOptional()
  @IsString()
  lotId?: string

  // Unidade dos lotes de origem (evita converter lotes de outra unidade)
  @IsOptional()
  @IsString()
  unitOrigem?: string

  // Sem decorator o ValidationPipe (whitelist) descartava a observação
  @IsOptional()
  @IsString()
  note?: string
}
