import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { ProcessHistoryType } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { StockBalanceQueryDto } from './dto/stock-balance.dto'
import { StockInDto, StockOutDto, StockTransferDto } from './dto/stock-move.dto'
import { StockConvertUnitDto } from './dto/stock-convert-unit.dto'
import { ProcessHistoryService } from '../process-history/process-history.service'
import { randomUUID } from 'crypto'
import { consumirLotes, criarLote, q2, RESIDUO, unidadeDoLote } from './stock-lots'

// Toda operação usa as regras únicas de `stock-lots.ts` (FIFO sem misturar
// unidades, um movimento por lote, dono do lote define próprio/terceiro).

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
      qtyRemaining: { gte: RESIDUO }, // lotes zerados ficam fora (filtrado no banco)
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

    // Data da última saída de cada lote (para "Saída parcial/total")
    const lotIds = lots.map(l => l.id)
    const ultimasSaidas = lotIds.length
      ? await this.prisma.stockMovement.groupBy({
          by: ['lotId'],
          where: { lotId: { in: lotIds }, type: 'out' as any },
          _max: { occurredAt: true },
        })
      : []
    const ultimaSaidaPorLote = new Map(ultimasSaidas.map((s: any) => [s.lotId, s._max.occurredAt]))

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

    return lots.map(lot => {
      const p = lot.product

      let ownerLabel = 'Tapajós'
      if (lot.empresaId && lot.empresaId !== q.companyId) {
        if (supplierNames.has(lot.empresaId)) {
          ownerLabel = `Fornecedor: ${supplierNames.get(lot.empresaId)}`
        } else if (customerNames.has(lot.empresaId)) {
          ownerLabel = `Cliente: ${customerNames.get(lot.empresaId)}`
        }
      }

      const restante = q2(lot.qtyRemaining)
      const inicial = q2(lot.qtyInitial)

      // Evento derivado do próprio lote — evita cruzamento entre lotes do mesmo produto/depósito
      let evento = 'Entrada'
      let dataEvento: Date = lot.occurredAt
      if (restante.lt(inicial)) {
        evento = 'Saída parcial'
        // data real da última saída; lotes antigos sem vínculo usam a última alteração do lote
        dataEvento = (ultimaSaidaPorLote.get(lot.id) as Date | undefined) ?? lot.updatedAt
      }

      return {
        id: lot.id,

        // Produto
        productId: p.id,
        productName: p.name,
        sku: p.sku,

        // Processo / Unidade
        processo: p.processo ?? '-',
        processoLote: lot.processo,
        unit: unidadeDoLote(lot),

        // Documento
        reference: lot.reference,
        dataNF: lot.occurredAt,

        // Estado derivado do lote
        evento,
        dataEvento,

        // Depósito
        warehouseId: lot.warehouseId,
        warehouseName: lot.warehouse?.name ?? '-',

        // Proprietário
        ownerLabel,
        empresaId: lot.empresaId,

        // Quantidade
        onHand: restante.toNumber(),
      }
    })
  }

  // ===========================================================
  // 📥 ENTRADA MANUAL
  // Sempre pertence à Tapajós (insumo importado por NF tem o fornecedor como
  // origem; aqui é entrada avulsa da própria empresa).
  // ===========================================================
  async stockIn(dto: StockInDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId: dto.tenantId, companyId: dto.companyId },
        select: { id: true, processo: true, unit: true, price: true, customerId: true, supplierId: true },
      })
      if (!product) throw new BadRequestException('Produto não encontrado')

      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId: dto.tenantId, companyId: dto.companyId },
        select: { id: true },
      })
      if (!warehouse) throw new BadRequestException('Depósito inválido')

      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
      const unit = dto.unit?.trim() || product.unit || null

      const { lot, movementId } = await criarLote(tx, {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: product.id,
        warehouseId: warehouse.id,
        empresaId: dto.companyId,
        processo: product.processo ?? '-',
        unit,
        quantity: dto.quantity,
        reference: dto.reference ?? null,
        occurredAt,
        movimento: {
          note: dto.note ?? null,
          occurredAt,
          unitCost: product.price as any,
          receiptImagePath: dto.receiptImagePath ?? null,
        },
      })

      await tx.processHistory.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          empresaId: dto.companyId,
          productId: dto.productId,
          type: ProcessHistoryType.STOCK_IN,
          status: 'APPLIED',
          quantity: lot.qtyInitial,
          unit,
          reference: dto.note ?? 'Entrada de estoque',
          processSnapshot: {
            warehouseId: lot.warehouseId,
            unit,
            movementId,
            lotId: lot.id,
            productEmpresaOrigem: {
              customerId: product.customerId ?? null,
              supplierId: product.supplierId ?? null,
            },
          },
        },
      })

      return { id: movementId, lotId: lot.id }
    })
  }

  // ===========================================================
  // 📤 SAÍDA — do lote escolhido, ou FIFO sem misturar unidades
  // ===========================================================
  async stockOut(dto: StockOutDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId: dto.tenantId, companyId: dto.companyId },
        select: { id: true, unit: true, price: true, customerId: true, supplierId: true },
      })
      if (!product) throw new BadRequestException('Produto não encontrado')

      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
      const { consumos, unit, total } = await consumirLotes(tx, {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        lotId: dto.lotId ?? null,
        empresaId: dto.empresaId ?? dto.empresaOrigemId ?? null,
        unit: dto.unit ?? null,
        movimento: { note: dto.note ?? null, reference: dto.reference ?? null, occurredAt },
      })

      await tx.processHistory.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          empresaId: dto.companyId,
          productId: dto.productId,
          type: ProcessHistoryType.STOCK_OUT,
          status: 'APPLIED',
          quantity: total,
          unit,
          reference: dto.note ?? 'Saída de estoque',
          processSnapshot: {
            warehouseId: dto.warehouseId,
            movementIds: consumos.map(c => c.movementId),
            lotes: consumos.map(c => ({ lotId: c.lotId, qty: c.qty.toNumber() })),
            reason: dto.note ?? null,
            productEmpresaOrigem: {
              customerId: product.customerId ?? null,
              supplierId: product.supplierId ?? null,
            },
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
          const amount = new Decimal(product.price ?? 0).mul(total)
          const billingTerms = customer.billingTerms ?? null
          const dueDate = this.computeDueDateFromBillingTerms(new Date(), billingTerms)

          // Um recebível por saída (sem somar em recebível existente — a fatura
          // agrupa pelo vencimento). Antes somava até em recebível já faturado.
          await tx.receivable.create({
            data: { tenantId: dto.tenantId, companyId: dto.companyId, customerId: customer.id, dueDate, amount, status: 'open' as any },
          })
          this.logger.log(`💰 Receivable criado via saída estoque (${billingTerms ?? '30d'}) — venc. ${dueDate.toISOString().slice(0, 10)}`)
        }
      }

      return { movementIds: consumos.map(c => c.movementId), total: total.toNumber(), unit }
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
  // 🔁 TRANSFERÊNCIA ENTRE DEPÓSITOS
  // Cada lote consumido vira um lote no destino com o mesmo dono, processo,
  // unidade, NF de origem e data — o FIFO e a rastreabilidade se mantêm.
  // ===========================================================
  async transfer(dto: StockTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Depósito de origem e destino são iguais')
    }
    return this.prisma.$transaction(async (tx) => {
      const destino = await tx.warehouse.findFirst({
        where: { id: dto.toWarehouseId, tenantId: dto.tenantId, companyId: dto.companyId },
        select: { id: true },
      })
      if (!destino) throw new BadRequestException('Depósito de destino inválido')

      const pairId = randomUUID()
      const now = new Date()
      const { consumos } = await consumirLotes(tx, {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.fromWarehouseId,
        quantity: dto.quantity,
        lotId: dto.lotId ?? null,
        empresaId: dto.empresaId ?? null,
        unit: dto.unit ?? null,
        movimento: { note: `TRANSFER_OUT → ${dto.toWarehouseId}`, pairId, occurredAt: now },
      })

      const lotesDestino: string[] = []
      for (const c of consumos) {
        const { lot } = await criarLote(tx, {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          productId: dto.productId,
          warehouseId: dto.toWarehouseId,
          empresaId: c.lot.empresaId,
          processo: c.lot.processo,
          unit: c.unit,
          quantity: c.qty,
          reference: c.lot.reference,
          occurredAt: c.lot.occurredAt,
          nfeImportId: c.lot.nfeImportId ?? null,
          movimento: { note: `TRANSFER_IN ← ${dto.fromWarehouseId} (lote ${c.lotId})`, pairId, occurredAt: now },
        })
        lotesDestino.push(lot.id)
      }

      return { pairId, lotesDestino }
    })
  }

  // ===========================================================
  // 🔁 CONVERSÃO DE UNIDADE (lote a lote)
  // Ex.: insumo importado em KG → MT. O dono do lote convertido é a empresa
  // destino escolhida (padrão na tela: Tapajós — o insumo comprado passa a ser
  // material da Tapajós). Cada lote de origem gera um lote convertido que
  // guarda a NF de origem e a data da NF.
  // ===========================================================
  async convertUnit(dto: StockConvertUnitDto) {
    if (!dto.productId) throw new BadRequestException('productId não informado')
    if (!dto.empresaDestinoId) throw new BadRequestException('Empresa destino não informada')
    if (!dto.unitDestino?.trim()) throw new BadRequestException('Unidade destino não informada')
    if (!dto.largura && (!dto.factor || dto.factor <= 0)) throw new BadRequestException('Informe fator ou largura')
    if (dto.largura && Number(dto.largura) <= 0) throw new BadRequestException('Largura inválida')

    // m² ÷ largura = metros lineares  →  fator = 1 / largura
    const fator = dto.largura ? new Decimal(1).div(dto.largura) : new Decimal(dto.factor!)
    const unidadeDestino = dto.unitDestino.trim()

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId: dto.tenantId, companyId: dto.companyId },
      })
      if (!product) throw new BadRequestException('Produto não encontrado')

      const pairId = randomUUID()
      const now = new Date()
      const { consumos, unit: unidadeOrigem, total } = await consumirLotes(tx, {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        lotId: dto.lotId ?? null,
        empresaId: dto.empresaOrigemId ?? null,
        unit: dto.unitOrigem ?? null,
        movimento: { note: dto.note ?? 'CONVERSAO_UNIDADE', pairId, occurredAt: now },
      })

      const convertidos: { de: string; para: string; qtyOrigem: number; qtyDestino: number }[] = []
      for (const c of consumos) {
        const qtyDestino = q2(c.qty.mul(fator))
        if (qtyDestino.lte(0)) continue
        const { lot } = await criarLote(tx, {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          productId: product.id,
          warehouseId: c.lot.warehouseId,
          empresaId: dto.empresaDestinoId,
          // processo atribuído no cadastro do produto tem prioridade (comportamento existente)
          processo: product.processo ?? c.lot.processo ?? 'Definir',
          unit: unidadeDestino,
          quantity: qtyDestino,
          reference: c.lot.reference,
          occurredAt: c.lot.occurredAt, // data da NF de origem, não a da conversão
          nfeImportId: c.lot.nfeImportId ?? null,
          movimento: {
            note: `CONVERSAO_UNIDADE ${c.unit ?? '?'}→${unidadeDestino} (lote ${c.lotId})`,
            pairId,
            occurredAt: now,
          },
        })
        convertidos.push({ de: c.lotId, para: lot.id, qtyOrigem: c.qty.toNumber(), qtyDestino: qtyDestino.toNumber() })
      }

      const totalDestino = convertidos.reduce((acc, x) => acc.add(x.qtyDestino), new Decimal(0))

      await tx.processHistory.create({
        data: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          empresaId: dto.companyId,
          productId: dto.productId,
          type: ProcessHistoryType.UNIT_CONVERSION,
          status: 'APPLIED',
          quantity: totalDestino,
          unit: unidadeDestino,
          reference: dto.note ?? 'Conversão de unidade',
          processSnapshot: {
            fromUnit: unidadeOrigem,
            toUnit: unidadeDestino,
            factor: fator.toNumber(),
            ...(dto.largura ? { largura: Number(dto.largura) } : {}),
            qtyOrigem: total.toNumber(),
            empresaDestinoId: dto.empresaDestinoId,
            warehouseId: dto.warehouseId,
            pairId,
            lotes: convertidos,
          },
        },
      })

      return { success: true, pairId, lotes: convertidos, totalDestino: totalDestino.toNumber() }
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
  // 📦 MOVIMENTOS DO LOTE
  // Pela ligação lotId; movimentos antigos sem a coluna preenchida ainda
  // aparecem pelo id do lote no texto da observação.
  // ===========================================================
  async getLotMovements(params: { lotId: string; tenantId: string; companyId: string }) {
    const lot = await this.prisma.stockLot.findFirst({
      where: { id: params.lotId, tenantId: params.tenantId, companyId: params.companyId },
      include: { product: true, warehouse: true, nfeImport: { select: { nfNumber: true, serie: true, emitente: true } } },
    })
    if (!lot) return { lot: null, movements: [] }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        OR: [{ lotId: params.lotId }, { lotId: null, note: { contains: params.lotId } }],
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    })

    return {
      lot: {
        id: lot.id,
        productName: lot.product.name,
        sku: lot.product.sku,
        processo: lot.processo,
        unit: unidadeDoLote(lot),
        warehouseName: lot.warehouse.name,
        qtyInitial: Number(lot.qtyInitial),
        qtyRemaining: Number(lot.qtyRemaining),
        occurredAt: lot.occurredAt,
        reference: lot.reference,
        nfEntrada: lot.nfeImport
          ? `${lot.nfeImport.serie ? lot.nfeImport.serie + '-' : ''}${lot.nfeImport.nfNumber ?? ''} — ${lot.nfeImport.emitente}`
          : null,
      },
      movements: movements.map(m => ({
        id: m.id,
        type: m.type,
        qty: Number(m.qty),
        unit: m.unit ?? unidadeDoLote(lot),
        ownership: m.ownership,
        note: m.note,
        reference: m.reference,
        occurredAt: m.occurredAt,
      })),
    }
  }
}
