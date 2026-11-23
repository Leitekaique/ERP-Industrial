import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { NON_BILLING_CFOPS } from '../../config/office.config'

// ─── Dashboard Service ─────────────────────────────────────────────────────────
//
// Retorna todos os dados necessários para a tela inicial do ERP:
//   - KPIs do mês atual (faturamento, NFs emitidas, recebíveis abertos)
//   - Comparativo mês atual vs. anterior
//   - Top 5 clientes por faturamento no mês
//   - Histórico dos últimos 6 meses para o gráfico de faturamento
//   - Alertas: faturas vencidas

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string, companyId: string, mesParam?: number, anoParam?: number) {
    const now = new Date()
    const anoAtual = anoParam ?? now.getFullYear()
    const mesAtual = mesParam ?? (now.getMonth() + 1) // 1-12

    // Mês anterior
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

    // Início e fim do mês atual
    const inicioMesAtual = new Date(anoAtual, mesAtual - 1, 1)
    const fimMesAtual = new Date(anoAtual, mesAtual, 0, 23, 59, 59)

    // Início e fim do mês anterior
    const inicioMesAnterior = new Date(anoAnterior, mesAnterior - 1, 1)
    const fimMesAnterior = new Date(anoAnterior, mesAnterior, 0, 23, 59, 59)

    // Início dos últimos 6 meses (para o gráfico)
    const inicio6Meses = new Date(anoAtual, mesAtual - 7, 1)

    // Intervalo para os 3 meses futuros (gráfico de faturamento projetado)
    const inicioFuturo = new Date(anoAtual, mesAtual, 1)         // início do próximo mês
    const fimFuturo = new Date(anoAtual, mesAtual + 3, 0, 23, 59, 59) // fim do 3º mês à frente

    // ── Consultas em paralelo para performance ─────────────────────────────────
    const [
      nfsMesAtual,
      nfsMesAnterior,
      nfs6Meses,
      recebiveis,
      _billings,
      _top5Clientes,
      producaoMes,
      ultimasEntradas,
      ultimasSaidas,
      pagamentosRecebidos6Meses,
      pagamentosPagos6Meses,
      payablesAbertos,
    ] = await Promise.all([
      // NFs autorizadas no mês atual
      this.prisma.nfe.findMany({
        where: {
          tenantId, companyId,
          status: 'authorized',
          issuedAt: { gte: inicioMesAtual, lte: fimMesAtual },
        },
        select: { id: true, totalInvoice: true, customerId: true, freightValue: true, items: { select: { cfop: true, total: true } } },
      }),

      // NFs autorizadas no mês anterior
      this.prisma.nfe.findMany({
        where: {
          tenantId, companyId,
          status: 'authorized',
          issuedAt: { gte: inicioMesAnterior, lte: fimMesAnterior },
        },
        select: { id: true, totalInvoice: true, freightValue: true, items: { select: { cfop: true, total: true } } },
      }),

      // NFs dos últimos 6 meses para o gráfico (inclui customerId para filtro por cliente)
      this.prisma.nfe.findMany({
        where: {
          tenantId, companyId,
          status: 'authorized',
          issuedAt: { gte: inicio6Meses },
        },
        select: { id: true, totalInvoice: true, freightValue: true, issuedAt: true, customerId: true, items: { select: { cfop: true, total: true, qty: true } } },
      }),

      // Recebíveis em aberto com vencimento no mês selecionado
      this.prisma.receivable.findMany({
        where: {
          tenantId, companyId,
          status: { in: ['open', 'partial'] as any[] },
          dueDate: { gte: inicioMesAtual, lte: fimMesAtual },
        },
        select: { id: true, amount: true, dueDate: true, status: true },
      }),

      // (slot reservado — não utilizado mais, removido billings)
      Promise.resolve([]),

      // placeholder removido
      Promise.resolve([]),

      // Histórico de processos no mês (produção por empresa/processo)
      // Filtra apenas STOCK_OUT vinculados a NF para evitar duplicidade com NF_EMITIDA
      this.prisma.processHistory.findMany({
        where: {
          tenantId, companyId,
          createdAt: { gte: inicioMesAtual, lte: fimMesAtual },
          type: 'STOCK_OUT',
          nfSaidaId: { not: null },
        },
        select: {
          customerId: true,
          quantity: true,
          unit: true,
          processSnapshot: true,
          process: { select: { name: true, customerId: true } },
          product: { select: { processo: true } },
        },
      }),

      // Últimas 10 entradas de caixa (pagamentos recebidos)
      this.prisma.payment.findMany({
        where: { receivable: { tenantId, companyId } },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          paidAt: true, amount: true,
          receivable: { select: { customer: { select: { name: true } } } },
        },
      }),

      // Últimas 10 saídas de caixa (pagamentos realizados)
      this.prisma.payablePayment.findMany({
        where: { payable: { tenantId, companyId } },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          paidAt: true, amount: true,
          payable: { select: { supplier: { select: { name: true } } } },
        },
      }),

      // Pagamentos recebidos (receivable payments) últimos 6 meses
      this.prisma.payment.findMany({
        where: {
          receivable: { tenantId, companyId },
          paidAt: { gte: inicio6Meses },
        },
        select: { amount: true, paidAt: true },
      }),

      // Pagamentos realizados (payable payments) últimos 6 meses
      this.prisma.payablePayment.findMany({
        where: {
          payable: { tenantId, companyId },
          paidAt: { gte: inicio6Meses },
        },
        select: { amount: true, paidAt: true },
      }),

      // Contas a pagar em aberto com vencimento no mês selecionado
      this.prisma.payable.findMany({
        where: {
          tenantId, companyId,
          status: 'open',
          dueDate: { gte: inicioMesAtual, lte: fimMesAtual },
        },
        select: { id: true, amount: true, dueDate: true },
      }),
    ])

    // ── Calcula faturamento do mês atual e anterior ────────────────────────────
    const faturamentoAtual = nfsMesAtual.reduce((acc: number, n: any) => acc + this.billingValue(n), 0)
    const faturamentoAnterior = nfsMesAnterior.reduce((acc: number, n: any) => acc + this.billingValue(n), 0)
    const variacaoFaturamento = faturamentoAnterior > 0
      ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100
      : null

    // ── Datas de referência ─────────────────────────────────────────────────────
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // ── Recebíveis futuros (para os 3 meses seguintes ao mês selecionado) ──────
    const receivablesFuturos = await this.prisma.receivable.findMany({
      where: { tenantId, companyId, dueDate: { gte: inicioFuturo, lte: fimFuturo } },
      select: { amount: true, dueDate: true, customerId: true },
    })

    // ── Próximos 10 títulos financeiros (receber + pagar) por vencimento ────────
    const [recebiveis10, payables10] = await Promise.all([
      this.prisma.receivable.findMany({
        where: { tenantId, companyId, status: { in: ['open', 'partial'] as any[] }, dueDate: { gte: hoje } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: { id: true, amount: true, dueDate: true, customer: { select: { name: true } } },
      }),
      this.prisma.payable.findMany({
        where: { tenantId, companyId, status: 'open' as any, dueDate: { gte: hoje } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: { id: true, amount: true, dueDate: true, supplier: { select: { name: true } } },
      }),
    ])

    const proximosTitulos = [
      ...(recebiveis10 as any[]).map((r: any) => ({ id: r.id, tipo: 'receber' as const, data: r.dueDate, valor: Number(r.amount), contraparte: r.customer?.name ?? '—' })),
      ...(payables10 as any[]).map((p: any) => ({ id: p.id, tipo: 'pagar' as const, data: p.dueDate, valor: Number(p.amount), contraparte: p.supplier?.name ?? '—' })),
    ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).slice(0, 10)

    // ── Agrupa NFs dos últimos 6 meses + 3 futuros por mês/ano para o gráfico ──
    const grafico = this.agruparPorMes(nfs6Meses as any[], 6, anoAtual, mesAtual, 3, receivablesFuturos as any[])

    // ── Recebíveis ─────────────────────────────────────────────────────────────
    const totalRecebivelAberto = recebiveis.reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
    const recebivelVencidos = recebiveis.filter((r: any) => new Date(r.dueDate) < hoje)
    const totalRecebivelVencido = recebivelVencidos.reduce((acc: number, r: any) => acc + Number(r.amount ?? 0), 0)

    // ── Contas a pagar ─────────────────────────────────────────────────────────
    const totalPayableAberto = payablesAbertos.reduce((acc: number, p: any) => acc + Number(p.amount ?? 0), 0)
    const payablesVencidos = payablesAbertos.filter((p: any) => new Date(p.dueDate) < hoje)
    const totalPayableVencido = payablesVencidos.reduce((acc: number, p: any) => acc + Number(p.amount ?? 0), 0)

    // ── Top 10 clientes — calculado a partir das NFs do mês ──────────────────
    const clienteTotals = new Map<string, number>()
    const clienteNfCount = new Map<string, number>()
    for (const nf of nfsMesAtual as any[]) {
      const cid = nf.customerId
      if (!cid) continue
      clienteTotals.set(cid, (clienteTotals.get(cid) ?? 0) + this.billingValue(nf))
      clienteNfCount.set(cid, (clienteNfCount.get(cid) ?? 0) + 1)
    }
    const topSorted = Array.from(clienteTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    const customerIds = topSorted.map(([id]) => id)
    const customerNames = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : []
    const nameById = new Map(customerNames.map((c: any) => [c.id, c.name]))

    const topClientes = topSorted.map(([customerId, totalFaturado]) => ({
      customerId,
      name: nameById.get(customerId) ?? 'Desconhecido',
      totalFaturado,
      totalNfs: clienteNfCount.get(customerId) ?? 0,
    }))

    // ── Produção do mês: agrupa por (empresa, processo) ──────────────────────
    const prodMap = new Map<string, { empresa: string; processo: string; qtd: number; unit: string }>()

    // Coleta customerIds: campo direto, via process, ou via processSnapshot.recipient.id
    const customerIdsProducao = [...new Set(
      (producaoMes as any[]).flatMap((p: any) => [
        p.customerId,
        p.process?.customerId,
        (p.processSnapshot as any)?.recipient?.id,
      ].filter(Boolean))
    )]
    const clientesProducao = customerIdsProducao.length
      ? await this.prisma.customer.findMany({ where: { id: { in: customerIdsProducao } }, select: { id: true, name: true } })
      : []
    const nomeClienteMap = new Map(clientesProducao.map((c: any) => [c.id, c.name]))

    for (const ph of producaoMes as any[]) {
      const snap = ph.processSnapshot as any
      // Resolve empresa: campo FK direto → process.customerId → nome do snapshot (para registros antigos)
      const cid = ph.customerId ?? ph.process?.customerId ?? snap?.recipient?.id ?? null
      const empresa = nomeClienteMap.get(cid) ?? snap?.recipient?.name ?? 'Sem empresa'
      // Resolve processo: FK direto → produto cadastrado → snapshot → fallback
      const processo = ph.process?.name ?? ph.product?.processo ?? snap?.processo ?? 'Sem processo'
      const key = `${empresa}|${processo}`
      const existing = prodMap.get(key)
      const qty = Number(ph.quantity ?? 0)
      if (qty <= 0) continue
      if (existing) {
        existing.qtd += qty
      } else {
        prodMap.set(key, { empresa, processo, qtd: qty, unit: ph.unit ?? '' })
      }
    }
    const tabelaProducao = Array.from(prodMap.values()).sort((a, b) => b.qtd - a.qtd)

    // ── Últimas transações de caixa ────────────────────────────────────────────
    const ultimasTransacoes = [
      ...(ultimasEntradas as any[]).map((p: any) => ({
        tipo: 'entrada' as const,
        data: p.paidAt,
        valor: Number(p.amount),
        contraparte: p.receivable?.customer?.name ?? '—',
      })),
      ...(ultimasSaidas as any[]).map((p: any) => ({
        tipo: 'saida' as const,
        data: p.paidAt,
        valor: Number(p.amount),
        contraparte: p.payable?.supplier?.name ?? '—',
      })),
    ]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 15)

    // ── Gráfico de quantidades produzidas (soma qty CFOP 5902/6902 por mês) ───
    const graficoQtd = this.agruparQtdPorMes(nfs6Meses as any[], 6, anoAtual, mesAtual)

    // ── Gráfico de fluxo de caixa (entradas - saídas) ─────────────────────────
    const graficoFluxo = this.agruparFluxoCaixaPorMes(
      pagamentosRecebidos6Meses as any[],
      pagamentosPagos6Meses as any[],
      6, anoAtual, mesAtual,
    )

    return {
      periodo: {
        mesAtual,
        anoAtual,
        label: this.mesLabel(mesAtual, anoAtual),
      },
      faturamento: {
        atual: faturamentoAtual,
        anterior: faturamentoAnterior,
        variacao: variacaoFaturamento,
        nfsEmitidas: nfsMesAtual.length,
        nfsEmitidasAnterior: nfsMesAnterior.length,
      },
      recebiveis: {
        totalAberto: totalRecebivelAberto,
        countAberto: recebiveis.length,
        totalVencido: totalRecebivelVencido,
        countVencido: recebivelVencidos.length,
      },
      payables: {
        totalAberto: totalPayableAberto,
        countAberto: payablesAbertos.length,
        totalVencido: totalPayableVencido,
        countVencido: payablesVencidos.length,
      },
      grafico,
      graficoQtd,
      graficoFluxo,
      topClientes,
      alertasBillings: [],   // mantido para compatibilidade — substituído por proximosTitulos
      proximosTitulos,
      tabelaProducao,
      ultimasTransacoes,
    }
  }

  // Agrupa lista de NFs por mês e retorna os últimos N meses (incluindo zeros)
  private billingValue(n: any): number {
    const items = n.items ?? []
    const frete = Number(n.freightValue ?? 0)
    // Itens cobráveis = CFOPs que não são retorno/devolução do cliente
    const billable = items.filter((it: any) => !NON_BILLING_CFOPS.includes(String(it.cfop ?? '')))
    if (billable.length > 0) return billable.reduce((acc: number, it: any) => acc + Number(it.total ?? 0), 0) + frete
    return Number(n.totalInvoice ?? 0) + frete
  }

  private agruparPorMes(
    nfs: Array<{ totalInvoice: any; issuedAt: Date | null; customerId?: string | null }>,
    qtdMesesPassados: number,
    anoRef: number,
    mesRef: number, // 1-12
    nMesesFuturos = 0,
    receivablesFuturos: Array<{ amount: any; dueDate: Date | null; customerId?: string | null }> = [],
  ) {
    const resultado: Array<{ label: string; mes: number; ano: number; total: number; projetado: number; porCliente: { customerId: string; total: number }[] }> = []

    for (let offset = -(qtdMesesPassados - 1); offset <= nMesesFuturos; offset++) {
      let m = mesRef + offset
      let a = anoRef
      while (m <= 0) { m += 12; a-- }
      while (m > 12) { m -= 12; a++ }

      const isFuture = offset > 0

      if (!isFuture) {
        const nfsDoMes = nfs.filter(n => {
          if (!n.issuedAt) return false
          const d = new Date(n.issuedAt)
          return d.getFullYear() === a && d.getMonth() + 1 === m
        })
        const total = nfsDoMes.reduce((acc: number, n: any) => acc + this.billingValue(n), 0)
        const porClienteMap = new Map<string, number>()
        nfsDoMes.forEach((n: any) => {
          const id = n.customerId ?? '__unknown'
          porClienteMap.set(id, (porClienteMap.get(id) ?? 0) + this.billingValue(n))
        })
        const porCliente = Array.from(porClienteMap.entries()).map(([customerId, t]) => ({ customerId, total: t }))
        resultado.push({ label: this.mesLabel(m, a), mes: m, ano: a, total, projetado: 0, porCliente })
      } else {
        // Meses futuros: projeção baseada em recebíveis com vencimento no mês
        const projetado = receivablesFuturos
          .filter(r => {
            if (!r.dueDate) return false
            const d = new Date(r.dueDate)
            return d.getFullYear() === a && d.getMonth() + 1 === m
          })
          .reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
        const porClienteMap = new Map<string, number>()
        receivablesFuturos.filter(r => {
          if (!r.dueDate) return false
          const d = new Date(r.dueDate)
          return d.getFullYear() === a && d.getMonth() + 1 === m
        }).forEach((r: any) => {
          const id = r.customerId ?? '__unknown'
          porClienteMap.set(id, (porClienteMap.get(id) ?? 0) + Number(r.amount ?? 0))
        })
        const porCliente = Array.from(porClienteMap.entries()).map(([customerId, t]) => ({ customerId, total: t }))
        resultado.push({ label: this.mesLabel(m, a), mes: m, ano: a, total: 0, projetado, porCliente })
      }
    }

    return resultado
  }

  // CFOPs de retorno de industrialização (intraestadual + interestadual)
  private static readonly RETORNO_CFOPS = new Set(['5902', '6902', '5903', '6903', '5916', '6916', '5925', '6925'])

  private agruparQtdPorMes(
    nfs: Array<{ issuedAt: Date | null; customerId?: string | null; items?: Array<{ qty?: any; cfop?: any }> }>,
    qtdMeses: number,
    anoRef: number,
    mesRef: number,
  ) {
    const resultado: Array<{ label: string; mes: number; ano: number; qtd: number; porCliente: { customerId: string; qtd: number }[] }> = []

    for (let i = qtdMeses - 1; i >= 0; i--) {
      let m = mesRef - i
      let a = anoRef
      while (m <= 0) { m += 12; a-- }

      const nfsDoMes = nfs.filter(n => {
        if (!n.issuedAt) return false
        const d = new Date(n.issuedAt)
        return d.getFullYear() === a && d.getMonth() + 1 === m
      })

      const porClienteMap = new Map<string, number>()
      let qtd = 0
      for (const n of nfsDoMes) {
        const retornoItems = (n.items ?? []).filter((it: any) =>
          DashboardService.RETORNO_CFOPS.has(String(it.cfop ?? ''))
        )
        const nQty = retornoItems.reduce((s: number, it: any) => s + Number(it.qty ?? 0), 0)
        qtd += nQty
        if (nQty > 0) {
          const cid = (n as any).customerId ?? '__unknown'
          porClienteMap.set(cid, (porClienteMap.get(cid) ?? 0) + nQty)
        }
      }
      const porCliente = Array.from(porClienteMap.entries()).map(([customerId, q]) => ({ customerId, qtd: q }))

      resultado.push({ label: this.mesLabel(m, a), mes: m, ano: a, qtd, porCliente })
    }

    return resultado
  }

  private agruparFluxoCaixaPorMes(
    recebimentos: Array<{ paidAt: Date; amount: any }>,
    pagamentos: Array<{ paidAt: Date; amount: any }>,
    qtdMeses: number,
    anoRef: number,
    mesRef: number,
  ) {
    const resultado: Array<{ label: string; mes: number; ano: number; entradas: number; saidas: number; saldo: number }> = []

    for (let i = qtdMeses - 1; i >= 0; i--) {
      let m = mesRef - i
      let a = anoRef
      while (m <= 0) { m += 12; a-- }

      const inMonth = (date: Date) => new Date(date).getFullYear() === a && new Date(date).getMonth() + 1 === m

      const entradas = recebimentos
        .filter(r => inMonth(r.paidAt))
        .reduce((acc, r) => acc + Number(r.amount ?? 0), 0)

      const saidas = pagamentos
        .filter(p => inMonth(p.paidAt))
        .reduce((acc, p) => acc + Number(p.amount ?? 0), 0)

      resultado.push({ label: this.mesLabel(m, a), mes: m, ano: a, entradas, saidas, saldo: entradas - saidas })
    }

    return resultado
  }

  private mesLabel(mes: number, ano: number): string {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${meses[mes - 1]}/${ano}`
  }
}
