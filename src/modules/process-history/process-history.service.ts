import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'
import {
  ProcessHistoryStatus,
  ProcessHistoryType,
} from '@prisma/client'

@Injectable()
export class ProcessHistoryService {
  constructor(private prisma: PrismaService) {}

  async record(params: {
    tenantId: string
    companyId: string

    // 🔥 obrigatório no banco, mas aqui deixamos opcional e fazemos fallback
    empresaId?: string

    type: ProcessHistoryType
    status?: ProcessHistoryStatus

    productId?: string | null
    processId?: string | null
    customerId?: string | null

    quantity?: number
    unit?: string

    reference?: string
    processSnapshot?: any
	nfEntrada?: string
    nfEntradaId?: string | null
    nfSaidaId?: string | null
  }) {
    return this.prisma.processHistory.create({
      data: {
        tenantId: params.tenantId,
        companyId: params.companyId,

        // fallback: se não veio, usa companyId
        empresaId: params.empresaId ?? params.companyId,

        type: params.type,
        status: params.status ?? ProcessHistoryStatus.APPLIED,

        productId: params.productId ?? null,
        processId: params.processId ?? null,
        customerId: params.customerId ?? null,

        quantity:
          params.quantity !== undefined
            ? new Decimal(params.quantity)
            : null,

        unit: params.unit ?? null,
        reference: params.reference ?? null,
        processSnapshot: params.processSnapshot ?? null,
		nfEntrada: params.nfEntrada ?? null,
        nfEntradaId: params.nfEntradaId ?? null,
        nfSaidaId: params.nfSaidaId ?? null,
      },
    })
  }

  // =====================================================
  // 🔗 Vínculo Produto ↔ Processo (snapshot)
  // =====================================================
  async registerProcessLinked(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    productId?: string | null
    processId: string
    processSnapshot: any
    reference?: string
  }) {
    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      productId: params.productId ?? null,
      processId: params.processId,
      type: ProcessHistoryType.PROCESS_LINKED,
      status: ProcessHistoryStatus.APPLIED,
      processSnapshot: params.processSnapshot,
      reference: params.reference ?? 'Processo vinculado ao produto',
    })
  }

  // =====================================================
  // 🔁 Conversão de unidade (estoque)
  // =====================================================
  async registerUnitConversion(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    productId?: string | null

    quantityFrom: number
    unitFrom: string
    quantityTo: number
    unitTo: string

    reference?: string
    snapshot?: any
  }) {
    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      productId: params.productId ?? null,
      type: ProcessHistoryType.UNIT_CONVERSION,
      status: ProcessHistoryStatus.APPLIED,
      quantity: params.quantityTo,
      unit: params.unitTo,
      processSnapshot:
        params.snapshot ??
        {
          from: { quantity: params.quantityFrom, unit: params.unitFrom },
          to: { quantity: params.quantityTo, unit: params.unitTo },
        },
      reference:
        params.reference ??
        `${params.quantityFrom} ${params.unitFrom} → ${params.quantityTo} ${params.unitTo}`,
    })
  }

  // =====================================================
  // 🔄 Troca de fornecedor / cliente
  // =====================================================
  async registerSupplierChanged(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    productId?: string | null
    fromSupplierId?: string
    toSupplierId?: string
    reference?: string
  }) {
    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      productId: params.productId ?? null,
      type: ProcessHistoryType.SUPPLIER_CHANGED,
      status: ProcessHistoryStatus.REASSIGNED,
      reference:
        params.reference ??
        `Fornecedor alterado: ${params.fromSupplierId} → ${params.toSupplierId}`,
    })
  }

  async registerCustomerChanged(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    productId?: string | null
    fromCustomerId?: string
    toCustomerId?: string
    reference?: string
  }) {
    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      productId: params.productId ?? null,
      type: ProcessHistoryType.CUSTOMER_CHANGED,
      status: ProcessHistoryStatus.REASSIGNED,
      reference:
        params.reference ??
        `Cliente alterado: ${params.fromCustomerId} → ${params.toCustomerId}`,
    })
  }

  // =====================================================
  // 💰 Alteração de preço do produto
  // =====================================================
  async registerProductPriceChanged(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    productId: string
    beforePrice: number
    afterPrice: number
    unit?: string
    reference?: string
  }) {
    if (params.beforePrice === params.afterPrice) return null

    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      productId: params.productId,
      type: ProcessHistoryType.PRICE_UPDATED,
      status: ProcessHistoryStatus.APPLIED,
      unit: params.unit,
      processSnapshot: {
        before: { price: params.beforePrice },
        after: { price: params.afterPrice },
      },
      reference: params.reference ?? 'Alteração de preço do produto',
    })
  }

  // =====================================================
  // ⚙️ Atualização cadastral do processo
  // =====================================================
  async registerProcessUpdated(params: {
    tenantId: string
    companyId: string
    empresaId?: string
    processId: string
    before: any
    after: any
    reference?: string
  }) {
    return this.record({
      tenantId: params.tenantId,
      companyId: params.companyId,
      empresaId: params.empresaId,
      processId: params.processId,
      type: ProcessHistoryType.PROCESS_UPDATED,
      status: ProcessHistoryStatus.APPLIED,
      processSnapshot: { before: params.before, after: params.after },
      reference: params.reference ?? 'Atualização de dados do processo',
    })
  }

  // =====================================================
  // 🧾 NF emitida / cancelada (quando integrar)
  // =====================================================
  async markAsInvoiced(params: {
    processHistoryId: string
    nfSaidaId: string
  }) {
    return this.prisma.processHistory.update({
      where: { id: params.processHistoryId },
      data: {
        nfSaidaId: params.nfSaidaId,
        status: ProcessHistoryStatus.INVOICED,
      },
    })
  }

  async cancel(params: {
    processHistoryId: string
    reference?: string
  }) {
    return this.prisma.processHistory.update({
      where: { id: params.processHistoryId },
      data: {
        status: ProcessHistoryStatus.CANCELED,
        reference: params.reference,
      },
    })
  }
}
