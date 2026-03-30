import { IsString, IsNumber, IsOptional, IsBoolean, IsObject } from 'class-validator'

export class CreateProductDto {
  @IsString()
  sku!: string

  @IsString()
  name!: string
  
  @IsString()
  empresaId!: string

  @IsOptional()
  @IsString()
  unit?: string

  @IsOptional()
  @IsString()
  ncm?: string

  @IsOptional()
  @IsString()
  cfop?: string

  @IsNumber()
  price!: number

  @IsOptional()
  taxes?: any
  
  // =========================================================
  // 🔹 ETAPA 2.3 — Processo aplicado ao PRODUTO MO
  // =========================================================

  /** ID do processo selecionado no PF */
  @IsOptional()
  @IsString()
  processId?: string

  /** Nome do processo (apenas espelho, não snapshot) */
  @IsOptional()
  @IsString()
  processo?: string

  // =========================================================
  // 🔹 ETAPA 5.2 — Transformação de INSUMO
  // =========================================================

  /** Unidade original do insumo (ex: M2, KG) */
  @IsOptional()
  @IsString()
  unitOrigem?: string

  /** Unidade final após transformação (ex: M) */
  @IsOptional()
  @IsString()
  unitDestino?: string

  /** Fator de conversão (ex: largura do filme) */
  @IsOptional()
  @IsNumber()
  fatorConversao?: number

  /** Margem aplicada sobre o custo */
  @IsOptional()
  @IsNumber()
  margem?: number

  /** Valor final calculado (override opcional) */
  @IsOptional()
  @IsNumber()
  valorAtualizado?: number

  /** Flag explícita de insumo */
  @IsOptional()
  @IsBoolean()
  isInsumo?: boolean
}
