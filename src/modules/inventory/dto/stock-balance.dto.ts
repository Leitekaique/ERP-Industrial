import { IsIn, IsOptional, IsString } from 'class-validator'

export class StockBalanceQueryDto {
  @IsString() tenantId!: string
  @IsString() companyId!: string

  @IsOptional() @IsString() warehouseId?: string
  @IsOptional() @IsString() productId?: string
  @IsOptional() @IsString() sku?: string


  // Usa SEUS enums/colunas
  @IsOptional() @IsIn(['own', 'third_party_in', 'third_party_out'])
  ownership?: 'own' | 'third_party_in' | 'third_party_out'

  // Só faz sentido quando ownership ≠ own
  @IsOptional() @IsString() supplierId?: string
  @IsOptional() @IsString() customerId?: string
}