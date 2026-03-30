import { IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() phone?: string
}
