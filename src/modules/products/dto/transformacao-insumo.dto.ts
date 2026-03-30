import { IsOptional, IsString, IsNumber } from 'class-validator'

export class TransformacaoInsumoDto {
  @IsOptional()
  @IsString()
  unidadeOrigem?: string

  @IsOptional()
  @IsString()
  unidadeDestino?: string

  @IsOptional()
  @IsNumber()
  metragemFinal?: number

  @IsOptional()
  @IsNumber()
  margem?: number


  @IsOptional()
  @IsString()
  empresaDestinoId?: string
}
