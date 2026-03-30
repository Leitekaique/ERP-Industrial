import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { CreateNfeDto } from './dto/create-nfe.dto'
import { NfeService } from './nfe.service'

@Controller('fiscal/nfe')
export class NfeController {
  constructor(private readonly service: NfeService) {}

  @Post()
  createDraft(@Body() dto: CreateNfeDto) {
    return this.service.createDraft(dto)
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.service.submit(id)
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }
}
