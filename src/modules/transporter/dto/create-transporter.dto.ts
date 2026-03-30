import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateTransporterDto {
  @IsNotEmpty()
  @IsString()
  tenantId!: string;

  @IsNotEmpty()
  @IsString()
  companyId!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  // ✅ CPF (11) ou CNPJ (14) - sempre só dígitos
  @IsNotEmpty()
  @IsString()
  @Length(11, 14)
  cnpj!: string;

  @IsOptional() @IsString()
  rntrc?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @IsString()
  district?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  state?: string;

  @IsOptional() @IsString()
  zip?: string;

  @IsOptional() @IsString()
  complement?: string;
}
