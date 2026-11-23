import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { ProcessHistoryType } from '@prisma/client'
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
        product: true,
        warehouse: true,
      },
      orderBy: { occurredAt: 'asc' },
    })

    // Resolve ownerLabel para qualquer empresaId (não só o supplier/customer do produto)
    const allEmpresaIds = [...new Set(lots.map(l => l.empresaId).filter((id): id is string => !!id))]
    const [suppliersRaw, customersRaw] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { id: { in: allEmpresaIds } },
        select: { id: true, name: true },
      }),
      this.prisma.customer.findMany({
        where: { id: { in: allEmpresaIds } },
        select: { id: true, name: true },
      }),
    ])
    const supplierNames = new Map(suppliersRaw.map(s => [s.id, s.name]))
    const customerNames = new Map(customersRaw.map(c => [c.id, c.name]))

    const result: any[] = []

    for (const lot of lots) {
      if (Number(lot.qtyRemaining) < 0.005) continue

      const p = lot.product

      let ownerLabel = 'Tapajós'
      if (lot.empresaId && lot.empresaId !== q.companyId) {
        if (supplierNames.has(lot.empresaId)) {
          ownerLabel = `Fornecedor: ${supplierNames.get(lot.empresaId)}`
        } else if (customerNames.has(lot.empresaId)) {
          ownerLabel = `Cliente: ${customerNames.get(lot.empresaId)}`
        }
      }

      const rawQty = Number(lot.qtyRemaining)
      const onHand = rawQty < 0.01 ? 0 : Number(rawQty.toFixed(2))
      const qtyInitial = Number(lot.qtyInitial)

      // Evento derivado do próprio lote — evita cruzamento entre lotes do mesmo produto/depósito
      let evento: string
      let dataEvento: Date
      if (rawQty < qtyInitial) {
        evento = rawQty <= 0.001 ? 'Saída total' : 'Saída parcial'
        dataEvento = lot.createdAt ?? lot.occurredAt
      } else {
        evento = 'Entrada'
        dataEvento = lot.occurredAt
      }

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

        // Estado derivado do lote (sem cruzamento entre lotes distintos)
        evento,
        dataEvento,

        // Depósito
        warehouseId: lot.warehouseId,
        warehouseName: lot.warehouse?.name ?? '-',

        // Proprietário
        ownerLabel,
        empresaId: lot.empresaId,

        // Quantidade
        onHand,
      })
    }

    return result
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

    const qty = Math.round(Number(dto.quantity) * 100) / 100
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

        // entrada manual sempre pertence à Tapajós (product.empresaId aponta pro fornecedor em insumos importados)
        empresaId: dto.companyId,

        processo: product.processo ?? '-',
        unit: product.unit ?? null,

        reference: (dto as any).reference ?? null,
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

    const lotsWhere: any = {
      tenantId: dto.tenantId,
      companyId: dto.companyId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      qtyRemaining: { gt: 0.004 }, // ignora resíduos < 0.01
    }
    const empresaFilter = dto.empresaId ?? (dto as any).empresaOrigemId
    if (empresaFilter) lotsWhere.empresaId = empresaFilter

    const lots = await tx.stockLot.findMany({
      where: lotsWhere,
      orderBy: { occurredAt: 'asc' },
    })

    // quantidade arredondada a 2 casas para evitar resíduos de ponto flutuante
    let remaining = Math.round(Number(dto.quantity) * 100) / 100
    let firstLotUsed: (typeof lots)[number] | null = null

    for (const lot of lots) {
      if (remaining <= 0) break

      const available = Math.round(Number(lot.qtyRemaining) * 100) / 100
      const consume = Math.min(available, remaining)

      if (!firstLotUsed && consume > 0) firstLotUsed = lot

      // decrement FIFO
      await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          qtyRemaining: { decrement: consume },
        },
      })

      remaining = Math.round((remaining - consume) * 100) / 100
    }

    if (remaining > 0.005) {
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
    return this.prisma.$transaction(async (tx) => {
      const pairId = randomUUID()

      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId: dto.tenantId, companyId: dto.companyId },
        select: { processo: true, unit: true },
      })
      if (!product?.processo) throw new BadRequestException('Produto sem processo definido')

      // Busca lotes FIFO de origem — filtra por empresaId se fornecido
      const lotsWhere: any = {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        warehouseId: dto.fromWarehouseId,
        productId: dto.productId,
        qtyRemaining: { gt: 0 },
      }
      if (dto.empresaId) lotsWhere.empresaId = dto.empresaId

      const sourceLots = await tx.stockLot.findMany({
        where: lotsWhere,
        orderBy: { occurredAt: 'asc' },
        select: { id: true, qtyRemaining: true, empresaId: true, processo: true, unit: true },
      })

      let remaining = Number(dto.quantity)

      // Estrutura para rastrear quanto foi consumido de cada (empresaId, processo, unit)
      const consumed = new Map<string, { empresaId: string; processo: string; unit: string | null; qty: number }>()

      for (const lot of sourceLots) {
        if (remaining <= 0) break
        const consume = Math.min(Number(lot.qtyRemaining), remaining)
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { decrement: consume } },
        })
        remaining -= consume

        // Agrupa por empresaId+processo para criar lotes destino preservando donos
        const key = `${lot.empresaId}|${lot.processo}|${lot.unit ?? ''}`
        const existing = consumed.get(key)
        if (existing) {
          existing.qty += consume
        } else {
          consumed.set(key, { empresaId: lot.empresaId, processo: lot.processo, unit: lot.unit, qty: consume })
        }
      }

      if (remaining > 0) throw new BadRequestException('Estoque insuficiente para transferência')

      // Movimento de saída
      await tx.stockMovement.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          warehouseId: dto.fromWarehouseId,
          productId: dto.productId,
          type: 'out',
          qty: dto.quantity,
          ownership: 'own',
          occurredAt: new Date(),
          note: `TRANSFER_OUT → ${dto.toWarehouseId}`,
        },
      })

      const movementIn = await tx.stockMovement.create({
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

      // Cria um lote destino por grupo (empresaId + processo) — preserva rastreabilidade
      for (const { empresaId, processo, unit, qty } of consumed.values()) {
        await tx.stockLot.create({
          data: {
            tenantId: dto.tenantId,
            companyId: dto.companyId,
            productId: dto.productId,
            warehouseId: dto.toWarehouseId,
            empresaId,
            processo,
            unit: unit ?? product.unit ?? null,
            reference: null,
            occurredAt: movementIn.occurredAt,
            qtyInitial: qty,
            qtyRemaining: qty,
          },
        })
      }

      return movementIn
    })
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
      if (!dto.largura && (!dto.factor || dto.factor <= 0))
        throw new BadRequestException('Informe fator ou largura')

      const lotsWhere: any = {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        qtyRemaining: { gt: 0 },
      }
      if ((dto as any).empresaOrigemId) {
        lotsWhere.empresaId = (dto as any).empresaOrigemId
      }

      const lots = await tx.stockLot.findMany({
        where: lotsWhere,
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

      if (!product) throw new BadRequestException('Produto não encontrado')

      // unidades
      const unidadeOrigem = baseLot.unit ?? product.unit ?? null
      const unidadeDestino = dto.unitDestino
      const factor = dto.largura
        ? 1 / Number(dto.largura)
        : Number(dto.factor ?? 1)

      // consumir FIFO — quantidade arredondada a 2 casas para evitar resíduos decimais
      const qtyToConsume = Math.round(Number(dto.quantity) * 100) / 100
      let remaining = qtyToConsume

      for (const lot of lots) {
        if (remaining <= 0) break

        const consume = Math.min(Math.round(Number(lot.qtyRemaining) * 100) / 100, remaining)

        await tx.stockLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { decrement: consume } },
        })

        remaining = Math.round((remaining - consume) * 100) / 100
      }

      if (remaining > 0.005) {
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

      const quantidadeConvertida = Math.round(Number(dto.quantity) * factor * 100) / 100

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

      // novo lote convertido — empresaId = empresa destino (não Tapajós)
      await tx.stockLot.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          productId: product.id,
          warehouseId: dto.warehouseId,
          empresaId: dto.empresaDestinoId,
          processo: product.processo ?? 'Definir',
          unit: unidadeDestino,
          reference: baseLot.reference,
          occurredAt: new Date(),
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
          ...(dto.largura ? { largura: dto.largura } : {}),
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

  // ===========================================================
  // 📦 MOVIMENTOS POR LOTE (sem migration — filtra pelo note)
  // ===========================================================
  async getLotMovements(params: { lotId: string; tenantId: string; companyId: string }) {
    const lot = await this.prisma.stockLot.findFirst({
      where: { id: params.lotId, tenantId: params.tenantId, companyId: params.companyId },
      include: { product: true, warehouse: true },
    })
    if (!lot) return { lot: null, movements: [] }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        note: { contains: params.lotId },
      },
      orderBy: { occurredAt: 'asc' },
    })

    return {
      lot: {
        id: lot.id,
        productName: lot.product.name,
        sku: lot.product.sku,
        processo: lot.processo,
        unit: lot.unit ?? lot.product.unit,
        warehouseName: lot.warehouse.name,
        qtyInitial: Number(lot.qtyInitial),
        qtyRemaining: Number(lot.qtyRemaining),
        occurredAt: lot.occurredAt,
        reference: lot.reference,
      },
      movements: movements.map(m => ({
        id: m.id,
        type: m.type,
        qty: Number(m.qty),
        note: m.note,
        reference: m.reference,
        occurredAt: m.occurredAt,
      })),
    }
  }

}
