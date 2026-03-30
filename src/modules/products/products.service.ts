import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProcessHistoryService } from '../process-history/process-history.service'
import { Decimal } from '@prisma/client/runtime/library'
import { ProcessHistoryType } from '@prisma/client'


@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
	private processHistoryService: ProcessHistoryService,
	)  {}

  async list(params: {
    tenantId: string
    companyId: string
    q?: string
  }) {
    const { tenantId, companyId, q } = params

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        companyId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        company: true,
        supplier: true,
        customer: true,
      },
      orderBy: { name: 'asc' },
    })
    return products.map(p => {
      let empresaOrigem = null
	  if (p.customerId) {
		empresaOrigem = {
			tipo: 'CUSTOMER',
			id: p.customerId,
			nome: p.customer?.name,
		}
	  } else if (p.supplierId) {
		empresaOrigem = {
			tipo: 'SUPPLIER',
			id: p.supplierId,
			nome: p.supplier?.name,
		}
	  } else {
		empresaOrigem = {
			tipo: 'COMPANY',
			id: companyId,
			nome: 'Tapajós',
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
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        company: true,
        supplier: true,
        customer: true,
      },
    })
    if (!product) {
      throw new BadRequestException('Produto não encontrado')
    }

let empresaOrigem = null
if (product.customerId) {
  empresaOrigem = { tipo: 'CUSTOMER', id: product.customerId, nome: product.customer?.name }
} else if (product.supplierId) {
  empresaOrigem = { tipo: 'SUPPLIER', id: product.supplierId, nome: product.supplier?.name }
} else {
  empresaOrigem = { tipo: 'COMPANY', id: product.companyId, nome: 'Tapajós' }
}

    return {
      ...product,
      empresaOrigem,
	  empresaNome: empresaOrigem?.nome ?? null,
	  empresaTipo: empresaOrigem?.tipo ?? null,
    }
  }
  async create(
    tenantId: string,
    companyId: string,
    dto: CreateProductDto,
  ) {
  let processoNome: string | null = null

  if (dto.processId) {
    const process = await this.prisma.process.findUnique({
      where: { id: dto.processId },
    })

    if (!process) {
      throw new BadRequestException('Processo inválido')
    }

    processoNome = process.name
  }
	const isCompany = dto.empresaId === companyId
    return this.prisma.product.create({
      data: {
        tenantId,
        companyId,
        empresaId: companyId,
		customerId: isCompany ? undefined : dto.empresaId,
		supplierId: undefined,
        sku: dto.sku,
        name: dto.name,
        unit: dto.unit ?? 'M',
        price: dto.price,
        ncm: dto.ncm ?? null,
        cfop: dto.cfop ?? null,
        processo: processoNome,
        taxes: dto.taxes ?? null,
      },
    })
  }
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      throw new BadRequestException('Produto não encontrado')
    }
    /**
     * ============================================================
     * UPDATE PADRÃO
     * ============================================================
     */
  const data: any = {
    ...(dto.sku !== undefined && { sku: dto.sku }),
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.unit !== undefined && { unit: dto.unit }),
    ...(dto.price !== undefined && { price: dto.price }),
    ...(dto.ncm !== undefined && { ncm: dto.ncm ?? null }),
    ...(dto.cfop !== undefined && { cfop: dto.cfop ?? null }),
    ...(dto.taxes !== undefined && { taxes: dto.taxes ?? null }),
  }
    // =====================================================
    // 🔹 ETAPA 2.3 — PROCESSO NO PRODUTO FÍSICO
    // =====================================================
    let processoAtualizado: { name: string; price: Decimal } | null = null

if (dto.processId) {
  const process = await this.prisma.process.findUnique({
    where: { id: dto.processId },
  })

  if (!process) {
    throw new BadRequestException('Processo inválido')
  }

  processoAtualizado = {
    name: process.name,
    price: process.price,
  }

  data.processo = process.name
await this.processHistoryService.record({
  tenantId: product.tenantId,
  companyId: product.companyId,

  empresaId: product.companyId, // 🔥 LINHA NOVA

  productId: product.id,
  processId: process.id,
  type: ProcessHistoryType.PROCESS_LINKED,

  processSnapshot: {
    processName: process.name,
    processPrice: process.price,
  },
})


}



  // =====================================================
// 🔹 ATUALIZA PF (FONTE DA VERDADE)
// =====================================================
const updatedPF = await this.prisma.product.update({
  where: { id },
  data,
})
const oldPrice =
  product.price instanceof Decimal ? product.price.toNumber() : Number(product.price)

let newPrice: number | undefined = undefined
if (dto.price !== undefined) {
  newPrice = Number(dto.price)
  if (!Number.isFinite(newPrice)) {
    throw new BadRequestException('Preço inválido')
  }
}

if (dto.price !== undefined && newPrice !== oldPrice) {

await this.processHistoryService.record({
  tenantId: product.tenantId,
  companyId: product.companyId,

  empresaId: product.companyId,

  productId: product.id,
  type: ProcessHistoryType.PRICE_UPDATED,
  unit: product.unit || undefined,

  processSnapshot: {
    before: oldPrice,
    after: newPrice,
  },
})
  }

// =====================================================
// 🔹 ESPELHA NO PMO (SE HOUVER PROCESSO)
// =====================================================
if (processoAtualizado) {
  await this.prisma.product.updateMany({
    where: {
      tenantId: updatedPF.tenantId,
      companyId: updatedPF.companyId,
      sku: updatedPF.sku,
      empresaId: updatedPF.companyId, // PMO
    },
    data: {
      processo: processoAtualizado.name,
      price: processoAtualizado.price,
      unit: updatedPF.unit,
    },
  })
}

return updatedPF

  }

async remove(id: string) {
  const hasMovements = await this.prisma.stockMovement.findFirst({
    where: { productId: id },
  })

  if (hasMovements) {
    throw new BadRequestException(
      'Produto possui movimentações de estoque e não pode ser excluído'
    )
  }

  return this.prisma.product.delete({ where: { id } })
}
}
