import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { MailService } from '../mail/mail.service'
import { Decimal } from '@prisma/client/runtime/library'
import { buildBillingPdf, BillingPdfData } from './billing-pdf'
import { OFFICE_EMAIL } from '../../config/office.config'

// ─── Billing Service ──────────────────────────────────────────────────────────
//
// Faturamento mensal: agrupa os Receivables abertos de um cliente em um mês
// em um único Billing (duplicata/boleto consolidado) e envia por e-mail.
//
// Fluxo:
//   1. generateBilling(tenantId, companyId, customerId, month, year)
//      → Coleta todos os Receivables open/partial do cliente no mês
//      → Cria Billing somando os valores
//      → Vincula cada Receivable ao Billing via billingId
//   2. sendBilling(id)
//      → Monta o corpo do e-mail com os itens
//      → Envia para: customer.email, customer.accountantEmail (se existir)
//      → Marca billing.sentAt e billing.status = 'sent'
//   3. markPaid(id) — marca o Billing como pago
//   4. checkOverdue() — chamado pelo cron diário
//      → Marca como 'overdue' os Billings sent com vencimento passado
//      → Envia lembretes de Receivables vencidos

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // ── Lista billings filtrados por tenant/company ─────────────────────────────
  async list(params: {
    tenantId: string
    companyId: string
    status?: string
    customerId?: string
    year?: number
    month?: number
  }) {
    const { tenantId, companyId, status, customerId, year, month } = params
    const where: any = { tenantId, companyId }
    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (year) where.year = Number(year)
    if (month) where.month = Number(month)

    return this.prisma.billing.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, accountantEmail: true, emailFinanceiro: true } },
        receivables: { select: { id: true, amount: true, dueDate: true, status: true, nfeId: true } },
      },
      orderBy: [{ dueDate: 'desc' }],
      take: 200,
    })
  }

  // ── Gera faturas para um cliente por mês/ano ──────────────────────────────
  // Agrupa os Receivables por dueDate e cria/atualiza um Billing por vencimento.
  // Se NFs do mesmo cliente têm prazos distintos, gera faturas separadas (a50).
  async generateBilling(params: {
    tenantId: string
    companyId: string
    customerId: string
    month: number // 1-12
    year: number
  }) {
    const { tenantId, companyId, customerId, month, year } = params

    if (month < 1 || month > 12) throw new BadRequestException('Mês inválido (1-12)')
    if (year < 2000 || year > 2099) throw new BadRequestException('Ano inválido')

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, companyId },
    })
    if (!customer) throw new BadRequestException('Cliente não encontrado')

    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0, 23, 59, 59)

    // Filtra por createdAt (mês em que a NF foi emitida / recebível foi gerado),
    // NÃO por dueDate — pois clientes dia15/dia20 têm vencimento no mês seguinte.
    const receivables = await this.prisma.receivable.findMany({
      where: {
        tenantId, companyId, customerId,
        billingId: null,
        status: { in: ['open', 'partial'] as any[] },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { dueDate: 'asc' },
    })

    if (!receivables.length) {
      throw new BadRequestException(
        `Nenhum recebível em aberto para ${customer.name} no mês ${month}/${year}`
      )
    }

    // Agrupa por data de vencimento (normalizada ao início do dia)
    const groups = new Map<string, typeof receivables>()
    for (const r of receivables) {
      const d = r.dueDate
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    const createdBillings: any[] = []

    for (const [dateKey, recs] of groups.entries()) {
      // Normaliza dueDate ao início do dia (00:00:00 UTC)
      const dueDate = new Date(dateKey + 'T00:00:00.000Z')
      const totalAmount = recs.reduce(
        (acc, r) => acc.add(new Decimal(r.amount as any)),
        new Decimal(0),
      )

      // Busca billing existente com este vencimento exato
      const existing = await this.prisma.billing.findFirst({
        where: { tenantId, companyId, customerId, dueDate },
      })

      let billing: any
      if (existing) {
        billing = await this.prisma.billing.update({
          where: { id: existing.id },
          data: { totalAmount, status: 'open' as any, sentAt: null },
        })
      } else {
        billing = await this.prisma.billing.create({
          data: { tenantId, companyId, customerId, month, year, dueDate, totalAmount, status: 'open' as any },
        })
      }

      await this.prisma.receivable.updateMany({
        where: { id: { in: recs.map(r => r.id) } },
        data: { billingId: billing.id },
      })

      this.logger.log(
        `✅ Billing gerado: ${billing.id} — ${customer.name} — vencimento ${dateKey} — R$ ${totalAmount.toFixed(2)}`
      )
      createdBillings.push(billing)
    }

    return { billings: createdBillings, total: createdBillings.length }
  }

  // ── Carrega billing completo (com company) para PDF ────────────────────────
  private async loadBillingFull(id: string): Promise<any> {
    return this.prisma.billing.findUnique({
      where: { id },
      include: {
        company: { select: { legalName: true, tradeName: true, cnpj: true, ie: true, address: true, number: true, district: true, city: true, uf: true, zip: true, phone: true, email: true } },
        customer: { select: { id: true, name: true, email: true, accountantEmail: true, emailFinanceiro: true, document: true, ie: true, address: true, city: true, state: true, zip: true, phone: true } },
        receivables: {
          include: { nfe: { select: { number: true, issuedAt: true, totalInvoice: true, totalProducts: true, items: { select: { kind: true, total: true } } } } },
          orderBy: { dueDate: 'asc' },
        },
      },
    })
  }

  // ── Gera Buffer PDF da duplicata ─────────────────────────────────────────────
  async getBillingPdf(id: string): Promise<Buffer> {
    const billing = await this.loadBillingFull(id)
    if (!billing) throw new BadRequestException('Billing não encontrado')
    return buildBillingPdf(this.toBillingPdfData(billing))
  }

  private toBillingPdfData(billing: any): BillingPdfData {
    const company = billing.company
    const customer = billing.customer

    const dueDate = billing.dueDate ?? billing.receivables?.[0]?.dueDate ?? new Date()

    // NFs referenciadas
    const nfs = billing.receivables
      .filter((r: any) => r.nfe)
      .map((r: any) => {
        const nfe = r.nfe
        // Valor de cobrança = soma dos itens PMO+INSUMO (se existirem), senão totalInvoice
        const billableItems = (nfe.items ?? []).filter((it: any) => it.kind === 'PMO' || it.kind === 'INSUMO')
        const billingVal = billableItems.length > 0
          ? billableItems.reduce((acc: number, it: any) => acc + Number(it.total ?? 0), 0)
          : Number(nfe.totalInvoice ?? nfe.totalProducts ?? r.amount)
        return {
          data: new Date(nfe.issuedAt).toLocaleDateString('pt-BR'),
          numero: String(nfe.number ?? ''),
          valor: billingVal,
        }
      })

    return {
      faturaNumero: billing.billingNumber,
      emissao: billing.createdAt,
      vencimento: dueDate,
      pago: billing.status === 'paid',
      pagamentoData: billing.paidAt ?? null,

      emitNome: company?.legalName || 'PELETIZAÇÃO TÊXTIL TAPAJÓS LTDA. - ME',
      emitFantasia: company?.tradeName || 'PELETIZAÇÃO TÊXTIL TAPAJÓS',
      emitEndereco: [company?.address, company?.number].filter(Boolean).join(', ') || 'Rua Gustavo Teixeira, 283',
      emitFone: company?.phone ?? '(19) 3454-4641',
      emitFax: '(19) 3454-9465',
      emitEmail: company?.email ?? 'peletizacaotapajos@yahoo.com.br',
      emitCnpj: company?.cnpj ?? '05.114.479/0001-00',
      emitIe: company?.ie ?? '606.203.479.118',
      emitBanco: 'Banco Itaú',
      emitAgencia: '1578',
      emitConta: '15996-2',

      sacadoNome: customer?.name ?? '',
      sacadoEndereco: customer?.address ?? '',
      sacadoCidade: customer?.city ?? '',
      sacadoEstado: customer?.state ?? '',
      sacadoCep: customer?.zip ?? '',
      sacadoCnpj: customer?.document ?? '',
      sacadoIe: customer?.ie ?? '',

      nfs,
      totalAmount: Number(billing.totalAmount),
    }
  }

  // ── Envia o Billing por e-mail com PDF anexo ────────────────────────────────
  async sendBilling(id: string) {
    const billing = await this.loadBillingFull(id)
    if (!billing) throw new BadRequestException('Billing não encontrado')

    const customer = billing.customer

    const toList: string[] = []
    if ((customer as any).emailFinanceiro) toList.push((customer as any).emailFinanceiro)
    else if (customer.email) toList.push(customer.email)
    if (OFFICE_EMAIL && !toList.includes(OFFICE_EMAIL)) toList.push(OFFICE_EMAIL)
    if (!toList.length) throw new BadRequestException(`Cliente ${customer.name} não possui e-mail cadastrado para envio da fatura.`)

    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const mesLabel = `${meses[billing.month - 1]}/${billing.year}`
    const total = Number(billing.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    // Gera PDF
    const pdfBuffer = await buildBillingPdf(this.toBillingPdfData(billing))

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;font-size:14px;line-height:1.6">
<p>Boa tarde prezado(a)</p>
<p>Envio anexo a fatura ${billing.billingNumber}.</p>
<p>Os dados bancários para efetuação do pagamento encontram-se no cabeçalho da fatura.</p>
<p>Dessa maneira, solicito que assinem, datem e reenviem a fatura neste endereço de e-mail, confirmando a conferência e recebimento da mesma.</p>
<p>Atenciosamente.</p>
<p><strong>Peletização Tapajós</strong></p>
</div>`

    await this.mail.sendMail({
      to: toList,
      subject: `Fatura ${billing.billingNumber} — ${customer.name}`,
      html,
      attachments: [{
        filename: `duplicata-${billing.billingNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    await this.prisma.billing.update({
      where: { id },
      data: { status: 'sent' as any, sentAt: new Date() },
    })

    this.logger.log(`📧 Billing ${billing.billingNumber} enviado para ${toList.join(', ')}`)
    return { enviado: true, destinatarios: toList }
  }

  // ── Marca Billing como pago ─────────────────────────────────────────────────
  async markPaid(id: string) {
    const paidAt = new Date()
    // Create Payment records for each unpaid receivable
    const full = await this.prisma.billing.findUnique({ where: { id }, include: { receivables: true } })
    if (full) {
      for (const r of full.receivables) {
        if (r.status !== 'paid' && r.status !== 'canceled') {
          await this.prisma.payment.create({ data: { receivableId: r.id, paidAt, amount: r.amount } })
          await this.prisma.receivable.update({ where: { id: r.id }, data: { status: 'paid' } })
        }
      }
    }
    const billing = await this.prisma.billing.update({
      where: { id },
      data: { status: 'paid' as any, paidAt },
      include: { customer: { select: { name: true } } },
    })

    if (OFFICE_EMAIL) this.mail.sendMail({
      to: OFFICE_EMAIL,
      subject: `Fatura paga — ${billing.customer?.name ?? billing.customerId} — Fatura Nº ${billing.billingNumber}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
<p>Olá,</p>
<p>A fatura ${billing.billingNumber} foi paga.</p>
<p>Grato!</p>
<p><strong>Tapajós</strong></p>
</div>`,
    }).catch(() => {})

    return billing
  }

  // ── Recebe a fatura completa (baixa todos os recebíveis de uma vez) ─────────
  async receiveFull(id: string, dto: { paidAt?: string; method?: string; note?: string }) {
    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: { receivables: true, customer: { select: { name: true } } },
    })
    if (!billing) throw new Error('Fatura não encontrada')

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()

    for (const r of billing.receivables) {
      if (r.status === 'paid') continue
      await this.prisma.payment.create({
        data: {
          receivableId: r.id,
          paidAt,
          amount: r.amount,
          details: { method: dto.method ?? 'pix', note: dto.note ?? null } as any,
        },
      })
      await this.prisma.receivable.update({ where: { id: r.id }, data: { status: 'paid' } })
    }

    return this.prisma.billing.update({
      where: { id },
      data: { status: 'paid' as any, paidAt },
      include: { customer: { select: { name: true } } },
    })
  }

  // ── Cancela e desvincula os receivables ─────────────────────────────────────
  async cancel(id: string) {
    await this.prisma.receivable.updateMany({
      where: { billingId: id },
      data: { billingId: null },
    })
    return this.prisma.billing.update({
      where: { id },
      data: { status: 'open' as any, sentAt: null },
    })
  }

  // ── Recebíveis em aberto sem fatura (a12) ─────────────────────────────────
  async getUnbilledReceivables(tenantId: string, companyId: string) {
    const receivables = await this.prisma.receivable.findMany({
      where: { tenantId, companyId, status: 'open', billingId: null },
      include: {
        customer: { select: { id: true, name: true } },
        nfe: { select: { number: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Agrupa por cliente
    const byCustomer: Record<string, { customerId: string; customerName: string; total: number; count: number; nfs: string[] }> = {}
    for (const r of receivables) {
      const cid = r.customerId
      if (!cid) continue
      if (!byCustomer[cid]) {
        byCustomer[cid] = { customerId: cid, customerName: (r as any).customer?.name ?? cid, total: 0, count: 0, nfs: [] }
      }
      byCustomer[cid].total += Number(r.amount)
      byCustomer[cid].count++
      // Usa nfeNumbers (campo acumulado) se disponível; senão fallback para nfe.number
      const nfeNums: string = (r as any).nfeNumbers ?? ((r as any).nfe?.number != null ? String((r as any).nfe.number) : '')
      for (const n of nfeNums.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        if (!byCustomer[cid].nfs.includes(n)) byCustomer[cid].nfs.push(n)
      }
    }

    return Object.values(byCustomer).sort((a, b) => b.total - a.total)
  }

  // ── Cron: verificação diária de vencidos ────────────────────────────────────
  // Chamado pelo BillingCronService todo dia às 8h.
  // Faz duas coisas:
  //   1. Marca Billings 'sent' com receivables vencidos → status 'overdue'
  //   2. Envia e-mail de lembrete para os clientes com vencidos
  async checkOverdue() {
    this.logger.log('🕐 Verificando recebíveis vencidos...')
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Busca Receivables open/partial com dueDate < hoje
    const vencidos = await this.prisma.receivable.findMany({
      where: {
        status: { in: ['open', 'partial'] as any[] },
        dueDate: { lt: hoje },
      },
      include: {
        customer: { select: { id: true, name: true, email: true, accountantEmail: true, emailFinanceiro: true } },
        billing: { select: { id: true, status: true } },
      },
      take: 500,
    })

    if (!vencidos.length) {
      this.logger.log('✅ Nenhum recebível vencido encontrado.')
      return
    }

    // Agrupa por cliente para enviar um único e-mail por cliente
    const porCliente = new Map<string, typeof vencidos>()
    for (const r of vencidos) {
      const key = r.customerId
      if (!porCliente.has(key)) porCliente.set(key, [])
      porCliente.get(key)!.push(r)
    }

    let totalEmail = 0
    for (const [, items] of porCliente) {
      const customer = items[0].customer
      const toList: string[] = []
      if (customer.email) toList.push(customer.email)
      if ((customer as any).accountantEmail) toList.push((customer as any).accountantEmail)
      if (customer.emailFinanceiro) toList.push(customer.emailFinanceiro)
      if (!toList.length) continue

      const totalVencido = items
        .reduce((acc, r) => acc + Number(r.amount), 0)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

      const linhas = items.map(r => {
        const venc = new Date(r.dueDate).toLocaleDateString('pt-BR')
        const val = Number(r.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const diasAtraso = Math.floor((Date.now() - r.dueDate.getTime()) / 86_400_000)
        return `<tr><td>${r.id.slice(0,8)}</td><td>${venc}</td><td>${val}</td><td>${diasAtraso} dia(s)</td></tr>`
      }).join('\n')

      const html = `
<h2>Lembrete de Vencimento — ${customer.name}</h2>
<p>Os seguintes títulos estão em atraso:</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif">
  <thead><tr style="background:#f0f0f0">
    <th>Fatura</th><th>Vencimento</th><th>Valor</th><th>Atraso</th>
  </tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot><tr style="font-weight:bold">
    <td colspan="2">Total em atraso</td><td>${totalVencido}</td><td></td>
  </tr></tfoot>
</table>
<p>Por favor, regularize os pagamentos em aberto.</p>
<p style="color:#888;font-size:12px">Este e-mail foi gerado automaticamente pelo ERP Tapajós.</p>
`
      await this.mail.sendMail({
        to: toList,
        subject: `⚠️ Títulos em atraso — ${customer.name} — ${totalVencido}`,
        html,
      })
      totalEmail++
    }

    // Marca Billings 'sent' com vencidos como 'overdue'
    const billingIdsVencidos = [...new Set(
      vencidos.filter(r => r.billing?.status === 'sent').map(r => r.billingId!)
    )]
    if (billingIdsVencidos.length) {
      await this.prisma.billing.updateMany({
        where: { id: { in: billingIdsVencidos } },
        data: { status: 'overdue' as any },
      })
    }

    this.logger.log(
      `✅ checkOverdue: ${vencidos.length} vencido(s) | ${totalEmail} e-mail(s) enviado(s) | ${billingIdsVencidos.length} billing(s) → overdue`
    )
  }
}
