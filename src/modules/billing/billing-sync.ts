import { Decimal } from '@prisma/client/runtime/library'
import { NON_BILLING_CFOPS } from '../../config/office.config'

// ─────────────────────────────────────────────────────────────────────────────
// Sincronia NF ↔ A Receber ↔ Fatura
//
// Regra: o valor de uma fatura é SEMPRE a soma dos recebíveis vinculados a ela
// que não estão cancelados. Quando uma NF é cancelada, o valor que ela gerou
// sai do recebível e a fatura é recalculada.
//
// Até nov/2026 clientes mensais (dia15/dia20) tinham várias NFs SOMADAS num
// único recebível (nfeNumbers = "6270, 6273"). Para esses registros antigos,
// o cancelamento SUBTRAI o valor da NF e tira o número da lista. Recebíveis
// novos são um por NF — cancelar vira só marcar o recebível como cancelado.
//
// As funções recebem `db` (PrismaService ou cliente de transação), para rodar
// dentro da mesma transação de quem chama.
// ─────────────────────────────────────────────────────────────────────────────

type Db = any

export type ResultadoSync = {
  recebiveisCancelados: number
  recebiveisAjustados: number
  faturasRecalculadas: { numero: number; totalAnterior: number; totalNovo: number; status: string }[]
  avisos: string[]
}

const vazio = (): ResultadoSync => ({ recebiveisCancelados: 0, recebiveisAjustados: 0, faturasRecalculadas: [], avisos: [] })

/** Valor que a NF gerou no A Receber: itens com CFOP cobrável + frete do emitente. */
export function valorCobradoDaNf(nfe: { items?: { cfop?: string | null; total?: any }[]; freightValue?: any }): Decimal {
  const itens = (nfe.items ?? []).filter(it => it.cfop && !NON_BILLING_CFOPS.includes(String(it.cfop)))
  if (itens.length === 0) return new Decimal(0) // sem itens cobráveis → não gerou recebível
  const soma = itens.reduce((acc, it) => acc.add(new Decimal(it.total ?? 0)), new Decimal(0))
  return soma.add(new Decimal(nfe.freightValue ?? 0))
}

/** Lista de números de NF do campo texto "6270, 6273". */
export function numerosDaLista(nfeNumbers: string | null | undefined): string[] {
  return (nfeNumbers ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

/** true se a NF gerou várias parcelas (mais de um recebível com o mesmo nfeId). */
function isParcela(rec: any, todos: any[]): boolean {
  return todos.filter(o => o.nfeId && o.nfeId === rec.nfeId).length > 1
}

/** Recalcula o total da fatura = soma dos recebíveis não cancelados vinculados a ela. */
export async function recalcularTotalFatura(db: Db, billingId: string) {
  const fatura = await db.billing.findUnique({
    where: { id: billingId },
    include: { receivables: { select: { amount: true, status: true } } },
  })
  if (!fatura) return null
  const totalNovo = fatura.receivables
    .filter((r: any) => r.status !== 'canceled')
    .reduce((acc: Decimal, r: any) => acc.add(new Decimal(r.amount)), new Decimal(0))
  const totalAnterior = new Decimal(fatura.totalAmount)
  if (!totalNovo.equals(totalAnterior)) {
    await db.billing.update({ where: { id: billingId }, data: { totalAmount: totalNovo } })
  }
  return { numero: fatura.billingNumber, status: fatura.status, totalAnterior: totalAnterior.toNumber(), totalNovo: totalNovo.toNumber() }
}

/**
 * Tira uma NF cancelada do A Receber (e da fatura, se já faturada).
 * - Recebível só desta NF → status 'canceled'
 * - Recebível acumulado (legado) → subtrai o valor e remove o número da lista
 * - Recebível já pago → não altera; devolve aviso (dinheiro recebido por NF cancelada)
 * - Fatura já enviada → recalcula e avisa para reenviar
 */
export async function removerNfDosRecebiveis(
  db: Db,
  nfe: { id: string; number: number | null; customerId: string | null; tenantId: string; companyId: string; items?: any[]; freightValue?: any },
): Promise<ResultadoSync> {
  const r = vazio()
  if (!nfe.customerId || nfe.number == null) return r
  const num = String(nfe.number)
  const valorNf = valorCobradoDaNf(nfe)

  // Candidatos: vinculados pelo nfeId, ou com o número na lista (acumulados)
  const candidatos = await db.receivable.findMany({
    where: {
      tenantId: nfe.tenantId, companyId: nfe.companyId, customerId: nfe.customerId,
      status: { not: 'canceled' },
      OR: [{ nfeId: nfe.id }, { nfeNumbers: { contains: num } }],
    },
  })
  // `contains` é textual ("627" casaria "6270") — confirma o número exato
  const recebiveis = candidatos.filter((rec: any) =>
    rec.nfeId === nfe.id || numerosDaLista(rec.nfeNumbers).includes(num))

  const faturasTocadas = new Set<string>()
  for (const rec of recebiveis) {
    if (rec.status === 'paid' || rec.status === 'partial') {
      r.avisos.push(
        `NF ${num} cancelada, mas o recebível (venc. ${new Date(rec.dueDate).toLocaleDateString('pt-BR')}) já tem pagamento registrado — ajuste manual necessário (estorno ou crédito ao cliente).`,
      )
      continue
    }

    const nums = numerosDaLista(rec.nfeNumbers)
    const restantes = nums.filter(n => n !== num)
    // Sem lista de números (registros muito antigos) só é "desta NF" se o valor
    // bater — senão pode ser um acúmulo de várias NFs e cancelar tudo seria errado.
    // Parcelas (vários recebíveis da mesma NF) também caem aqui: todas canceladas.
    const valorBate = new Decimal(rec.amount).sub(valorNf).abs().lte(0.01)
    const soDestaNf = nums.length > 0 ? restantes.length === 0 : (rec.nfeId === nfe.id && (valorBate || valorNf.isZero() || isParcela(rec, recebiveis)))

    if (soDestaNf) {
      await db.receivable.update({ where: { id: rec.id }, data: { status: 'canceled' } })
      r.recebiveisCancelados++
    } else {
      // Legado: recebível com várias NFs somadas
      let novoValor = new Decimal(rec.amount).sub(valorNf)
      if (novoValor.isNegative()) {
        r.avisos.push(`NF ${num}: valor da NF maior que o do recebível acumulado — recebível zerado; conferir manualmente.`)
        novoValor = new Decimal(0)
      }
      await db.receivable.update({
        where: { id: rec.id },
        data: {
          amount: novoValor,
          nfeNumbers: restantes.join(', '),
          // nfeId apontava para a 1ª NF do acúmulo; se era esta, desvincula
          ...(rec.nfeId === nfe.id ? { nfeId: null } : {}),
          ...(novoValor.isZero() ? { status: 'canceled' } : {}),
        },
      })
      if (novoValor.isZero()) r.recebiveisCancelados++
      else r.recebiveisAjustados++
    }
    if (rec.billingId) faturasTocadas.add(rec.billingId)
  }

  for (const billingId of faturasTocadas) {
    const f = await recalcularTotalFatura(db, billingId)
    if (!f) continue
    r.faturasRecalculadas.push(f)
    if (f.status === 'sent' || f.status === 'overdue') {
      r.avisos.push(`Fatura ${f.numero} já tinha sido enviada ao cliente: total corrigido de R$ ${f.totalAnterior.toFixed(2)} para R$ ${f.totalNovo.toFixed(2)}. Reenvie a fatura.`)
    } else if (f.status === 'paid') {
      r.avisos.push(`Fatura ${f.numero} já está paga: total recalculado para R$ ${f.totalNovo.toFixed(2)}; conferir o valor recebido.`)
    }
  }
  return r
}

/**
 * Corrige dados antigos: toda NF cancelada que ainda aparece num recebível
 * ativo é removida dele (e as faturas são recalculadas).
 * Com `simular: true` roda numa transação desfeita no final — mostra o que
 * mudaria sem gravar nada.
 */
export async function reconciliarNfsCanceladas(
  prisma: Db,
  params: { tenantId: string; companyId: string; customerId?: string; simular?: boolean },
) {
  const SIMULACAO = Symbol('simulacao')
  const relatorio = { nfsCorrigidas: [] as number[], ...vazio() }

  const executar = async (tx: Db) => {
    const canceladas = await tx.nfe.findMany({
      where: {
        tenantId: params.tenantId, companyId: params.companyId, status: 'canceled',
        customerId: params.customerId ? params.customerId : { not: null },
      },
      select: { id: true, number: true, customerId: true, tenantId: true, companyId: true, freightValue: true, items: { select: { cfop: true, total: true } } },
    })
    for (const nfe of canceladas) {
      const res = await removerNfDosRecebiveis(tx, nfe)
      if (res.recebiveisCancelados || res.recebiveisAjustados || res.avisos.length) {
        relatorio.nfsCorrigidas.push(nfe.number!)
        relatorio.recebiveisCancelados += res.recebiveisCancelados
        relatorio.recebiveisAjustados += res.recebiveisAjustados
        relatorio.faturasRecalculadas.push(...res.faturasRecalculadas)
        relatorio.avisos.push(...res.avisos)
      }
    }
    if (params.simular) throw SIMULACAO // desfaz tudo
  }

  try {
    await prisma.$transaction(executar, { timeout: 60_000 })
  } catch (e) {
    if (e !== SIMULACAO) throw e
  }
  return { simulacao: !!params.simular, ...relatorio }
}
