import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTransporterDto } from './dto/create-transporter.dto';
import { ListTransporterDto } from './dto/list-transporter.dto';

@Injectable()
export class TransporterService {
  constructor(private prisma: PrismaService) {}

  async listar(params: ListTransporterDto) {
    if (!params.tenantId || !params.companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios.');
    }

    return this.prisma.transporter.findMany({
      where: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        ...(params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: 'insensitive' } },
                { cnpj: { contains: params.q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async criar(dto: CreateTransporterDto) {
    if (!dto.tenantId || !dto.companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios.');
    }

    return this.prisma.transporter.create({ data: dto });
  }

  async buscar(id: string) {
    return this.prisma.transporter.findUnique({ where: { id } });
  }

  async atualizar(id: string, dto: Partial<CreateTransporterDto>) {
    return this.prisma.transporter.update({ where: { id }, data: dto });
  }

  async excluir(id: string) {
    return this.prisma.transporter.delete({ where: { id } });
  }
}
