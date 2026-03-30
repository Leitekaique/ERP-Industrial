import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreatePayableDto } from './dto/create-payable.dto'
import { CreatePayablePaymentDto } from './dto/create-payment.dto'
import { Decimal } from '@prisma/client/runtime/library'

@Injectable()
export class PayablesService {
  constructor(private prisma: PrismaService) {}

  async list(params: { tenantId: string; companyId: string; status?: string; supplierId?: string; from?: string; to?: string; category?: string }) {
    const { tenantId, companyId, status, supplierId, from, to, category } = params
    const where: any = { tenantId, companyId }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (category) where.category = category
    if (from || to) {
      where.dueDate = {}
      if (from) where.dueDate.gte = new Date(from)
      if (to) where.dueDate.lte = new Date(to + 'T23:59:59')
    }
    const payables = await this.prisma.payable.findMany({
      where,
      include: { supplier: true, payments: true },
      orderBy: { dueDate: 'asc' },
      take: 200,
    })

    // Join NfeImport to get the actual NF number (nfeReceivedId references NfeImport.id)
    const nfeIds = payables.map(p => p.nfeReceivedId).filter(Boolean) as string[]
    const nfes = nfeIds.length
      ? await this.prisma.nfeImport.findMany({ where: { id: { in: nfeIds } }, select: { id: true, nfNumber: true, serie: true } })
      : []
    const nfeMap = new Map(nfes.map(n => [n.id, { id: n.id, number: n.nfNumber, series: n.serie }]))

    return payables.map(p => ({
      ...p,
      nfeReceived: p.nfeReceivedId ? (nfeMap.get(p.nfeReceivedId) ?? null) : null,
    }))
  }

  get(id: string) {
    return this.prisma.payable.findUnique({ where: { id }, include: { supplier: true, payments: true } })
  }

  async create(dto: CreatePayableDto) {
    return this.prisma.payable.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        supplierId: dto.supplierId,
        nfeReceivedId: dto.nfeReceivedId,
        dueDate: new Date(dto.dueDate),
        amount: new Decimal(dto.amount),
        paymentMethod: dto.paymentMethod as any,
      },
    })
  }

  async addPayment(id: string, dto: CreatePayablePaymentDto) {
    const payment = await this.prisma.payablePayment.create({
      data: {
        payableId: id,
        paidAt: new Date(dto.paidAt),
        amount: new Decimal(dto.amount),
        details: dto.details as any,
      },
    })

    const pay = await this.prisma.payable.findUnique({ where: { id }, include: { payments: true } })
    const paid = pay?.payments.reduce((a: number, p: any) => a + Number(p.amount), 0) ?? 0
    const status = paid >= Number(pay?.amount ?? 0) ? 'paid' : (paid > 0 ? 'partial' : 'open')

    await this.prisma.payable.update({ where: { id }, data: { status } })
    return payment
  }

  async update(id: string, dto: any) {
    const data: any = {}
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate)
    if (dto.amount !== undefined) data.amount = new Decimal(dto.amount)
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod
    if (dto.category !== undefined) data.category = dto.category || null
    return this.prisma.payable.update({ where: { id }, data })
  }

  async cancel(id: string) {
    return this.prisma.payable.update({ where: { id }, data: { status: 'canceled' } })
  }

  // ── Categorias personalizadas de A Pagar ────────────────────────────────────
  readonly DEFAULT_CATEGORIES = [
    'Matéria prima', 'Frete / Transporte', 'Energia elétrica', 'Água e saneamento',
    'Impostos e taxas', 'Serviços terceiros', 'Manutenção e reparo',
    'Salários e benefícios', 'Equipamentos', 'Material de escritório', 'Outros',
  ]

  async getCategories(companyId: string): Promise<string[]> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { payableCategories: true } })
    const custom = Array.isArray(company?.payableCategories) ? (company!.payableCategories as string[]) : []
    const all = [...this.DEFAULT_CATEGORIES]
    for (const c of custom) {
      if (!all.includes(c)) all.push(c)
    }
    return all
  }

  async addCategory(companyId: string, name: string): Promise<string[]> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { payableCategories: true } })
    const current = Array.isArray(company?.payableCategories) ? (company!.payableCategories as string[]) : []
    if (!current.includes(name)) {
      await this.prisma.company.update({ where: { id: companyId }, data: { payableCategories: [...current, name] } })
    }
    return this.getCategories(companyId)
  }

  async removeCategory(companyId: string, name: string): Promise<string[]> {
    if (this.DEFAULT_CATEGORIES.includes(name)) return this.getCategories(companyId) // não remove padrões
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { payableCategories: true } })
    const current = Array.isArray(company?.payableCategories) ? (company!.payableCategories as string[]) : []
    await this.prisma.company.update({ where: { id: companyId }, data: { payableCategories: current.filter(c => c !== name) } })
    return this.getCategories(companyId)
  }
}
