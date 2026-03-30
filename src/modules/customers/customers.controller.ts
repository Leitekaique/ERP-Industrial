import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CustomersService } from './customers.service'
import { UpdateCustomerDto, CreateCustomerDto} from './dto/customer.dto'


@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get()
  async list(@Query('tenantId') tenantId: string, 
  @Query('companyId') companyId: string, 
  @Query('q') q?: string) {
    return this.svc.list({ tenantId, companyId, q })
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.svc.get(id)
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}