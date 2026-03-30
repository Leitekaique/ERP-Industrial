import { IsOptional, IsString } from 'class-validator';

export class ListTransporterDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
