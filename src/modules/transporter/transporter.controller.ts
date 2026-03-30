import { Controller, Get, Post, Patch, Delete, Body, Query, Param } from '@nestjs/common';
import { TransporterService } from './transporter.service';
import { CreateTransporterDto } from './dto/create-transporter.dto';
import { ListTransporterDto } from './dto/list-transporter.dto';

@Controller('transporter')
export class TransporterController {
  constructor(private readonly svc: TransporterService) {}

  @Get()
  listar(@Query() query: ListTransporterDto) {
    return this.svc.listar(query);
  }

  @Get(':id')
  buscar(@Param('id') id: string) {
    return this.svc.buscar(id);
  }

  @Post()
  criar(@Body() dto: CreateTransporterDto) {
    return this.svc.criar(dto);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: Partial<CreateTransporterDto>) {
    return this.svc.atualizar(id, dto);
  }

  @Delete(':id')
  excluir(@Param('id') id: string) {
    return this.svc.excluir(id);
  }
}
