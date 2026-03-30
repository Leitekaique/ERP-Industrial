import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { StockMovement, ProcessHistoryType } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { StockBalanceQueryDto } from './dto/stock-balance.dto'
import { StockInDto, StockOutDto, StockTransferDto } from './dto/stock-move.dto'
import { StockConvertUnitDto } from './dto/stock-convert-unit.dto'
import { ProcessHistoryService } from '../process-history/process-history.service'
import { randomUUID } from 'crypto'

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name)

  constructor(
    private prisma: PrismaService,
    private processHistoryService: ProcessHistoryService,
  ) {}

  // ===========================================================
  // 📊 SALDO (LOTES)
  // ===========================================================
  async getBalance(q: StockBalanceQueryDto) {
    const where: any = {
      tenantId: q.tenantId,
      companyId: q.companyId,
    }

    if (q.productId) where.productId = q.productId
    if (q.warehouseId) where.warehouseId = q.warehouseId

    const lots = await this.prisma.stockLot.findMany({
      where,
      include: {
        product: {
          include: {
            company: true,
            supplier: true,
            customer: true,
          },
        },
        warehouse: true,
      },
      orderBy: { occurredAt: 'asc' },
    })

    const result: any[] = []

    for (const lot of lots) {
      if (Number(lot.qtyRemaining) <= 0) continue

      const lastMovement = await this.prisma.stockMovement.findFirst({
        where: {
          tenantId: lot.tenantId,
          companyId: lot.companyId,
          productId: lot.productId,
          warehouseId: lot.warehouseId,
          occurredAt: { gte: lot.occurredAt },
        },
        orderBy: { occurredAt: 'desc' },
      })

      const p = lot.product

      let ownerLabel = 'Tapajós'
      if (lot.empresaId === p.supplierId) {
        ownerLabel = `Fornecedor: ${p.supplier?.name ?? '-'}`
      } else if (lot.empresaId === p.customerId) {
        ownerLabel = `Cliente: ${p.customer?.name ?? '-'}`
      }

      const rawQty = Number(lot.qtyRemaining)
      const onHand = rawQty < 0.01 ? 0 : Number(rawQty.toFixed(2))

      result.push({
        id: lot.id,

        // Produto
        productId: p.id,
        productName: p.name,
        sku: p.sku,

        // Processo / Unidade
        processo: p.processo ?? '-',
        processoLote: lot.processo,
        unit: lot.unit ?? p.unit,

        // Documento
        reference: lot.reference,
        dataNF: lot.occurredAt,

        // 🔥 EVENTO REAL
        evento: lastMovement ? this.mapEvento(lastMovement) : 'Entrada',
        dataEvento: lastMovement?.occurredAt ?? lot.occurredAt,

        // Depósito
        warehouseId: lot.warehouseId,
        warehouseName: lot.warehouse?.name ?? '-',

        // Proprietário
        ownerLabel,

        // Quantidade
        onHand,
      })
    }

    return result
  }

  private mapEvento(m: StockMovement) {
    if (m.note?.includes('CONVERSAO_UNIDADE')) {
      return 'Conversão de unidade'
    }
    if (m.type === 'in') return 'Entrada'
    if (m.type === 'out') return 'Saída'
    return 'Movimentação'
  }

  // ===========================================================
  // 📥 ENTRADA
  // ===========================================================
async stockIn(dto: StockInDto) {
  return this.prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        tenantId: dto.tenantId,
        companyId: dto.companyId,
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
		empresaId: true,
        processo: true,
        unit: true,
        price: true,
        customerId: true,
        supplierId: true,
      },
    })

    if (!product) throw new BadRequestException('Produto não encontrado')

    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        tenantId: dto.tenantId,
        companyId: dto.companyId,
      },
      select: { id: true },
    })

    if (!warehouse) throw new BadRequestException('Depósito inválido')

    const qty = Number(dto.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Quantidade inválida')
    }

    const now = new Date()

    const movement = await tx.stockMovement.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        type: 'in',
        qty,
        unitCost: product.price, // mantém Decimal se já vier Decimal
        ownership: 'own',
        occurredAt: now,
        note: dto.note ?? null,
        receiptImagePath: (dto as any).receiptImagePath ?? null,
      },
    })

    const createdLot = await tx.stockLot.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: product.id,
        warehouseId: warehouse.id,

        // ✅ sempre Company (Tapajós)
        empresaId: product.empresaId,

        processo: product.processo ?? '-',
        unit: product.unit ?? null,

        reference: null,
        occurredAt: now, // usa a mesma data do movimento
        qtyInitial: qty,
        qtyRemaining: qty,
      },
    })

    // ✅ histórico dentro da mesma transação
    await tx.processHistory.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,

        // ✅ sempre Company (Tapajós)
        empresaId: dto.companyId,

        productId: dto.productId,
        type: ProcessHistoryType.STOCK_IN,
        status: 'APPLIED',

        quantity: new Decimal(qty),
        unit: createdLot.unit ?? null,

        reference: dto.note ?? 'Entrada de estoque',

        processSnapshot: {
          warehouseId: createdLot.warehouseId,
          unit: createdLot.unit ?? null,
          movementId: movement.id,
          lotId: createdLot.id,

          // ✅ origem do produto (informativo)
          productEmpresaOrigem: {
            customerId: product.customerId ?? null,
            supplierId: product.supplierId ?? null,
          },
        },
      },
    })

    return movement
  })
}
// ===========================================================
// 📤 SAÍDA (FIFO) — ATÔMICO
// ===========================================================
async stockOut(dto: StockOutDto) {
  return this.prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        tenantId: dto.tenantId,
        companyId: dto.companyId,
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        unit: true,
        processo: true,
        price: true,
        customerId: true,
        supplierId: true,
      },
    })

    if (!product) throw new BadRequestException('Produto não encontrado')

    // Se sua regra exige processo para movimentar, mantém:
    if (!product.processo) {
      throw new BadRequestException('Produto sem processo definido')
    }

    const lots = await tx.stockLot.findMany({
      where: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        qtyRemaining: { gt: 0 },
      },
      orderBy: { occurredAt: 'asc' },
    })

    let remaining = Number(dto.quantity)
    let firstLotUsed: (typeof lots)[number] | null = null

    for (const lot of lots) {
      if (remaining <= 0) break

      const available = Number(lot.qtyRemaining)
      const consume = Math.min(available, remaining)

      if (!firstLotUsed && consume > 0) firstLotUsed = lot

      // decrement FIFO
      await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          qtyRemaining: { decrement: consume },
        },
      })

      remaining -= consume
    }

    if (remaining > 0) {
      throw new BadRequestException('Estoque insuficiente')
    }

    const movement = await tx.stockMovement.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        type: 'out',
        qty: Number(dto.quantity),
        ownership: 'own', // se você tiver regra para third_party_out, ajusta aqui
        occurredAt: new Date(),
        note: dto.note ?? null,
      },
    })

    // unidade do primeiro lote usado (FIFO), fallback no produto
    const unit = (firstLotUsed?.unit ?? product.unit) ?? null

    // ✅ histórico 100% atômico (mesma transação)
    await tx.processHistory.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,

        // ✅ sempre Company (Tapajós) para enriquecer sem quebrar FK
        empresaId: dto.companyId,

        productId: dto.productId,
        type: ProcessHistoryType.STOCK_OUT,
        status: 'APPLIED',

        quantity: Number(dto.quantity) as any, // se seu Prisma espera Decimal, ele converte; senão ajuste
        unit,

        reference: dto.note ?? 'Saída de estoque',

        processSnapshot: {
          warehouseId: dto.warehouseId,
          movementId: movement.id,
          reason: dto.note ?? null,

          // ✅ origem do produto (não quebra tipagem porque está dentro do JSON)
          productEmpresaOrigem: {
            customerId: product.customerId ?? null,
            supplierId: product.supplierId ?? null,
          },

          // ✅ FIFO info útil
          firstLotUsedId: firstLotUsed?.id ?? null,
        },
      },
    })

    // ── E.2/F.3: Gerar cobrança (Receivable) na saída sem NF ─────────────────
    if (dto.generateCharge && product.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: product.customerId },
        select: { id: true, billingTerms: true },
      })

      if (customer) {
        const amount = new Decimal(product.price ?? 0).mul(new Decimal(dto.quantity))
        const issueDate = new Date()
        const billingTerms = customer.billingTerms ?? null
        const dueDate = this.computeDueDateFromBillingTerms(issueDate, billingTerms)
        const isMonthly = billingTerms === 'dia15' || billingTerms === 'dia20'

        if (isMonthly) {
          const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1)
          const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59)
          const existing = await tx.receivable.findFirst({
            where: {
              tenantId: dto.tenantId, companyId: dto.companyId,
              customerId: customer.id, status: 'open' as any,
              dueDate: { gte: startOfMonth, lte: endOfMonth },
            },
          })
          if (existing) {
            await tx.receivable.update({
              where: { id: existing.id },
              data: { amount: new Decimal(existing.amount).add(amount) },
            })
            this.logger.log(`💰 Receivable acumulado (${billingTerms}) via saída estoque — cliente ${customer.id}`)
          } else {
            await tx.receivable.create({
              data: { tenantId: dto.tenantId, companyId: dto.companyId, customerId: customer.id, dueDate, amount, status: 'open' as any },
            })
            this.logger.log(`💰 Receivable mensal criado via saída estoque — venc. ${dueDate.toISOString().slice(0, 10)}`)
          }
        } else {
          await tx.receivable.create({
            data: { tenantId: dto.tenantId, companyId: dto.companyId, customerId: customer.id, dueDate, amount, status: 'open' as any },
          })
          this.logger.log(`💰 Receivable criado via saída estoque — venc. ${dueDate.toISOString().slice(0, 10)}`)
        }
      }
    }

    return movement
  })
}

private computeDueDateFromBillingTerms(issueDate: Date, billingTerms?: string | null): Date {
  const d = new Date(issueDate)
  if (!billingTerms) { d.setDate(d.getDate() + 30); return d }
  if (billingTerms === 'dia15') { d.setMonth(d.getMonth() + 1); d.setDate(15); return d }
  if (billingTerms === 'dia20') { d.setMonth(d.getMonth() + 1); d.setDate(20); return d }
  const m = billingTerms.match(/^(\d+)d$/)
  if (m) { d.setDate(d.getDate() + parseInt(m[1], 10)); return d }
  d.setDate(d.getDate() + 30)
  return d
}

  // ===========================================================
  // 🔁 TRANSFERÊNCIA
  // ===========================================================
  async transfer(dto: StockTransferDto) {
    const pairId = randomUUID()

    await this.stockOut({
      tenantId: dto.tenantId,
      companyId: dto.companyId,
      warehouseId: dto.fromWarehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      note: `TRANSFER_OUT → ${dto.toWarehouseId}`,
    } as any)

    const movementIn = await this.prisma.stockMovement.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        warehouseId: dto.toWarehouseId,
        productId: dto.productId,
        type: 'in',
        qty: dto.quantity,
        pairId,
        ownership: 'own',
        occurredAt: new Date(),
        note: `TRANSFER_IN ← ${dto.fromWarehouseId}`,
      },
    })

    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        tenantId: dto.tenantId,
        companyId: dto.companyId,
      },
    })

    if (!product?.processo) {
      throw new BadRequestException('Produto sem processo definido')
    }

    await this.prisma.stockLot.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.toWarehouseId,
        empresaId: dto.companyId,
        processo: product.processo,
        unit: product.unit ?? null,
        reference: null,
        occurredAt: movementIn.occurredAt,
        qtyInitial: dto.quantity,
        qtyRemaining: dto.quantity,
      },
    })

    return movementIn
  }
  // ===========================================================
  // 🔁 CONVERSÃO DE UNIDADE (FIFO + novo lote)
  // ===========================================================
  async convertUnit(dto: StockConvertUnitDto) {
    return this.prisma.$transaction(async (tx) => {
      if (!dto.productId) throw new BadRequestException('productId não informado')
      if (!dto.empresaDestinoId)
        throw new BadRequestException('Empresa destino não informada')
      if (!dto.unitDestino)
        throw new BadRequestException('Unidade destino não informada')
      if (!dto.factor || dto.factor <= 0)
        throw new BadRequestException('Fator inválido')

      const lots = await tx.stockLot.findMany({
        where: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          qtyRemaining: { gt: 0 },
        },
        orderBy: { occurredAt: 'asc' },
      })

      if (!lots.length) {
        throw new BadRequestException('Nenhum lote disponível para conversão')
      }

      const baseLot = lots[0]

      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          tenantId: dto.tenantId,
          companyId: dto.companyId,
        },
      })

      if (!product?.processo) {
        throw new BadRequestException('Produto sem processo definido')
      }

      // unidades
      const unidadeOrigem = baseLot.unit ?? product.unit ?? null
      const unidadeDestino = dto.unitDestino
      const factor = Number(dto.factor)

      // consumir FIFO
      let remaining = dto.quantity

      for (const lot of lots) {
        if (remaining <= 0) break

        const consume = Math.min(Number(lot.qtyRemaining), remaining)

        await tx.stockLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { decrement: consume } },
        })

        remaining -= consume
      }

      if (remaining > 0) {
        throw new BadRequestException('Estoque insuficiente para conversão')
      }

      // saída
      await tx.stockMovement.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          warehouseId: dto.warehouseId,
          productId: product.id,
          type: 'out',
          qty: dto.quantity,
          ownership: 'own',
          note: dto.note ?? 'CONVERSAO_UNIDADE',
          occurredAt: new Date(),
        },
      })

      const quantidadeConvertida = Number(dto.quantity) * factor

      // entrada convertida
      await tx.stockMovement.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          warehouseId: dto.warehouseId,
          productId: product.id,
          type: 'in',
          qty: quantidadeConvertida,
          ownership: 'own',
          note: `CONVERSAO_UNIDADE → empresa ${dto.empresaDestinoId}`,
          occurredAt: new Date(),
        },
      })

      // novo lote convertido
      await tx.stockLot.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          productId: product.id,
          warehouseId: dto.warehouseId,
          empresaId: dto.companyId,
          processo: product.processo,
          unit: unidadeDestino,
          reference: baseLot.reference,
          occurredAt: baseLot.occurredAt,
          qtyInitial: quantidadeConvertida,
          qtyRemaining: quantidadeConvertida,
        },
      })

      await this.processHistoryService.record({
        tenantId: dto.tenantId,
        companyId: dto.companyId,

        empresaId: dto.companyId,

        productId: dto.productId,
        type: ProcessHistoryType.UNIT_CONVERSION,

        quantity: quantidadeConvertida,
        unit: unidadeDestino,

        processSnapshot: {
          fromUnit: unidadeOrigem,
          toUnit: unidadeDestino,
          factor,
          empresaDestinoId: dto.empresaDestinoId,
          warehouseId: dto.warehouseId,
          baseLotId: baseLot.id,
        },
        reference: dto.note ?? 'Conversão de unidade',
      })

      return { success: true }
    })
  }

  // ===========================================================
  // 📜 HISTÓRICO GERAL E POR PRODUTO (para o botão "Histórico")
  // ===========================================================
async getProcessHistoryList(params: { tenantId: string; companyId: string }) {
  const history = await this.prisma.processHistory.findMany({
    where: {
      tenantId: params.tenantId,
      companyId: params.companyId,
    },
    orderBy: { createdAt: 'desc' },
  })

  return this.enrichHistory(history)
}

async getProcessHistory(params: { tenantId: string; companyId: string; productId: string }) {
  const history = await this.prisma.processHistory.findMany({
    where: {
      tenantId: params.tenantId,
      companyId: params.companyId,
      productId: params.productId,
    },
    orderBy: { createdAt: 'desc' },
  })

  return this.enrichHistory(history)
}

// helper compartilhado (sem include!)
private async enrichHistory(history: any[]) {
  const empresaIds = Array.from(new Set(history.map(h => h.empresaId).filter(Boolean)))
  const productIds = Array.from(new Set(history.map(h => h.productId).filter(Boolean)))
  const processIds = Array.from(new Set(history.map(h => h.processId).filter(Boolean)))
  const nfEntradaIds = Array.from(new Set(history.map(h => h.nfEntradaId).filter(Boolean)))
  const nfSaidaIds = Array.from(new Set(history.map(h => h.nfSaidaId).filter(Boolean)))

  const [empresas, products, processes, nfEntrada, nfSaida] = await Promise.all([
    empresaIds.length
      ? this.prisma.company.findMany({ where: { id: { in: empresaIds } } })
      : Promise.resolve([]),
    productIds.length
      ? this.prisma.product.findMany({ where: { id: { in: productIds } } })
      : Promise.resolve([]),
    processIds.length
      ? this.prisma.process.findMany({ where: { id: { in: processIds } } })
      : Promise.resolve([]),
    nfEntradaIds.length
      ? this.prisma.nfeImport.findMany({ where: { id: { in: nfEntradaIds } } })
      : Promise.resolve([]),
    nfSaidaIds.length
      ? this.prisma.nfe.findMany({ where: { id: { in: nfSaidaIds } } })
      : Promise.resolve([]),
  ])

  const empresaById = new Map(empresas.map(e => [e.id, e]))
  const productById = new Map(products.map(p => [p.id, p]))
  const processById = new Map(processes.map(p => [p.id, p]))
  const nfEntradaById = new Map(nfEntrada.map(n => [n.id, n]))
  const nfSaidaById = new Map(nfSaida.map(n => [n.id, n]))

  return history.map(h => {
    const empresa = empresaById.get(h.empresaId)
    const product = h.productId ? productById.get(h.productId) : null
    const process = h.processId ? processById.get(h.processId) : null
    const nfeIn = h.nfEntradaId ? nfEntradaById.get(h.nfEntradaId) : null
    const nfeOut = h.nfSaidaId ? nfSaidaById.get(h.nfSaidaId) : null

    return {
      id: h.id,
      date: h.createdAt,

      type: h.type,
      status: h.status,

      empresaId: h.empresaId,
      empresa: empresa?.tradeName ?? empresa?.legalName ?? null,

      productId: h.productId ?? null,
      productSku: product?.sku ?? null,
      productName: product?.name ?? null,

      processId: h.processId ?? null,
      processName: process?.name ?? null,

      quantity: h.quantity ? Number(h.quantity) : null,
      unit: h.unit ?? null,

      nfEntradaId: h.nfEntradaId ?? null,
      nfEntrada: nfeIn?.accessKey ?? nfeIn?.id ?? null,

      nfSaidaId: h.nfSaidaId ?? null,
      nfSaida: nfeOut?.number ?? nfeOut?.id ?? null,

      reference: h.reference ?? null,
      snapshot: h.processSnapshot ?? null,
    }
  })
}

  async listWarehouses(params: { tenantId: string; companyId: string }) {
  return this.prisma.warehouse.findMany({
    where: {
      tenantId: params.tenantId,
      companyId: params.companyId,
    },
    orderBy: { name: 'asc' },
  })
}

}
