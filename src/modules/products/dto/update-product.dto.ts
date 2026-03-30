import { PartialType } from '@nestjs/mapped-types'
import { IsOptional, IsString, IsNumber, IsObject, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CreateProductDto } from './create-product.dto'
import { TransformacaoInsumoDto } from './transformacao-insumo.dto'
/**
 * DTO de UPDATE
 * - Mantém compatibilidade total com CreateProductDto
 * - Adiciona comportamentos específicos de update
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {

  /**
   * ============================================================
   * ETAPA 2.3 — Processo aplicado ao Produto Físico
   * ============================================================
   * Usado SOMENTE no update
   * - Não é persistido no product diretamente
   * - Dispara sincronização PF → PMO
   */
  @IsOptional()
  @IsString()
  processId?: string


  /**
   * ============================================================
   * ETAPA 5.2 — Transformação de Insumo
   * ============================================================
   * Estrutura isolada para não misturar regras
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => TransformacaoInsumoDto)
  transformacaoInsumo?: TransformacaoInsumoDto
}