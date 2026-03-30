import { IsNotEmpty } from 'class-validator'

export class CreateWarehouseDto {
  @IsNotEmpty() tenantId!: string
  @IsNotEmpty() companyId!: string
  @IsNotEmpty() name!: string
  @IsNotEmpty() code!: string
}
