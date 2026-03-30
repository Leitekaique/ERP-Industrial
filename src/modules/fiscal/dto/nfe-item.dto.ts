import { IsNumber, IsOptional, IsString } from 'class-validator'

export class NfeItemDto {
  @IsOptional() @IsString() productId?: string
  @IsString() description!: string
  @IsOptional() @IsString() cfop?: string
  @IsOptional() @IsString() ncm?: string
  @IsNumber() qty!: number
  @IsOptional() @IsString() unit?: string
  @IsNumber() unit_price!: number
}
