import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateReceivableDto } from './dto/create-receivable.dto'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { Decimal } from '@prisma/client/runtime/library'

@Injectable()
export class ReceivablesService {
  constructor(private prisma: PrismaService) {}

  list(params: { tenantId: string; companyId: string; status?: string; from?: string; to?: string }) {
    const { tenantId, companyId, status, from, to } = params
    const where: any = { tenantId, companyId }
    if (status) where.status = status
    if (from || to) {
      where.dueDate = {}
      if (from) where.dueDate.gte = new Date(from)
      if (to) where.dueDate.lte = new Date(to + 'T23:59:59')
    }
    return this.prisma.receivable.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, nfe: true, payments: true, billing: { select: { id: true, billingNumber: true, status: true, dueDate: true, paidAt: true, month: true, year: true } } },
      orderBy: { dueDate: 'asc' },
      take: 200,
    })
  }

  findOne(id: string) {
    return this.prisma.receivable.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true } }, nfe: true, payments: true },
    })
  }

  cancel(id: string) {
    return this.prisma.receivable.update({ where: { id }, data: { status: 'canceled' as any } })
  }

  create(dto: CreateReceivableDto) {
    return this.prisma.receivable.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        customerId: dto.customerId,
        nfeId: dto.nfeId,
        dueDate: new Date(dto.dueDate),
        amount: new Decimal(dto.amount),
        paymentMethod: dto.paymentMethod as any,
      },
    })
  }

  async listPayments(receivableId: string) {
    // Ordena do mais recente pro mais antigo
    return this.prisma.payment.findMany({
      where: { receivableId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async createPayment(id: string, dto: CreatePaymentDto) {
    const payment = await this.prisma.payment.create({
      data: {
        receivableId: id,
        paidAt: new Date(dto.paidAt),
        amount: new Decimal(dto.amount),
        details: dto.details as any,
      },
    })
    const rec = await this.prisma.receivable.findUnique({ where: { id }, include: { payments: true } })
    const paid = (rec?.payments ?? []).reduce((acc: number, p: { amount: any }) => {return acc + Number(p.amount ?? 0)}, 0)
    const status = paid >= Number(rec?.amount ?? 0) ? 'paid' : (paid > 0 ? 'partial' : 'open')
    await this.prisma.receivable.update({ where: { id }, data: { status } })
    return payment
  }
}
