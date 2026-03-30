import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateProcessDto } from './dto/create-process.dto'
import { UpdateProcessDto } from './dto/update-process.dto'

@Injectable()
export class ProcessesService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    tenantId: string
    companyId: string
    customerId?: string
    search?: string
    active?: boolean
  }) {
    const { tenantId, companyId, customerId, search, active } = params

    const processes = await this.prisma.process.findMany({
      where: {
        tenantId,
        companyId,
        ...(customerId ? { customerId } : {}),
        ...(typeof active === 'boolean' ? { active } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { unit: { contains: search, mode: 'insensitive' } },
                { artigo: { contains: search, mode: 'insensitive' } },
                { forro: { contains: search, mode: 'insensitive' } },
                { cola: { contains: search, mode: 'insensitive' } },
                {
                  customer: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
      },
      orderBy: { name: 'asc' },
    })

    return processes.map(p => {
      let empresaOrigem = null

      if (p.customerId === companyId) {
        empresaOrigem = {
          tipo: 'COMPANY',
          id: companyId,
          nome: 'Tapajós',
        }
      } else {
        empresaOrigem = {
          tipo: 'CUSTOMER',
          id: p.customerId,
          nome: p.customer?.name,
        }
      }

      return {
        ...p,
        empresaOrigem,
        empresaNome: empresaOrigem?.nome ?? null,
        empresaTipo: empresaOrigem?.tipo ?? null,
      }
    })
  }

  async findOne(id: string) {
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!process) {
      throw new BadRequestException('Processo não encontrado')
    }

    let empresaOrigem = null

    if (process.customerId === process.companyId) {
      empresaOrigem = {
        tipo: 'COMPANY',
        id: process.companyId,
        nome: 'Tapajós',
      }
    } else {
      empresaOrigem = {
        tipo: 'CUSTOMER',
        id: process.customerId,
        nome: process.customer?.name,
      }
    }

    return {
      ...process,
      empresaOrigem,
      empresaNome: empresaOrigem?.nome ?? null,
      empresaTipo: empresaOrigem?.tipo ?? null,
    }
  }

  async create(dto: CreateProcessDto) {
    if (!dto.empresaId || dto.empresaId.trim() === '') {
      throw new BadRequestException('empresaId é obrigatório para criar um processo')
    }

    const customerId =
      dto.empresaId === dto.companyId
        ? dto.companyId
        : dto.empresaId

    return this.prisma.process.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        customerId,
        name: dto.name,
        description: dto.description ?? undefined,
        unit: dto.unit ?? undefined,
        price: dto.price,
        artigo: dto.artigo ?? undefined,
        forro: dto.forro ?? undefined,
        cola: dto.cola ?? undefined,
        active: dto.active ?? true,
      },
    })
  }

  async update(id: string, dto: UpdateProcessDto) {
      const current = await this.prisma.process.findUnique({
    where: { id },
    select: { companyId: true },
  })
  if (!current) {
    throw new BadRequestException('Processo não encontrado')
  }	
	const data: any = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.artigo !== undefined && { artigo: dto.artigo }),
      ...(dto.forro !== undefined && { forro: dto.forro }),
      ...(dto.cola !== undefined && { cola: dto.cola }),
      ...(dto.active !== undefined && { active: dto.active }),
    }
  if (dto.empresaId !== undefined) {
    if (dto.empresaId === current.companyId) {
      data.customerId = current.companyId
    } else {
      data.customerId = dto.empresaId
    }
  }
    return this.prisma.process.update({
      where: { id },
      data,
    })
  }
  	async remove(id: string) {
	return this.prisma.process.delete({
    where: { id },
	})
	return this.prisma.process.delete({ where: { id } })
	}
}
