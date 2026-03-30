import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ProcessesService } from './processes.service'
import { CreateProcessDto } from './dto/create-process.dto'
import { UpdateProcessDto } from './dto/update-process.dto'

@Controller('processes')
export class ProcessesController {
  constructor(private service: ProcessesService) {}
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }
  @Get()
  list(@Query() q: any) {
    return this.service.list(q)
  }
  @Post()
	create(
	  @Req() req: Request & { tenantId: string; companyId: string },
	  @Body() dto: CreateProcessDto,
	) {
		return this.service.create({
			...dto,
			tenantId: req.tenantId,
			companyId: req.companyId,
		})
	}
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    return this.service.update(id, dto)
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
  return this.service.remove(id)
}
}