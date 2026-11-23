import { BadRequestException } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'

// ─────────────────────────────────────────────────────────────────────────────
// Regras únicas de lote — usadas por TODA operação de estoque
// (entrada manual, saída, transferência, conversão, NF emitida, importação).
//
//  • Quantidades com 2 casas decimais (o que a operação usa); resíduo abaixo de
//    0,005 conta como zero.
//  • Um movimento por lote afetado, com `lotId` e `unit` — o histórico do lote
//    é completo e um estorno sabe exatamente para onde devolver.
//  • Saída sem lote escolhido segue FIFO (lote mais antigo primeiro), mas nunca
//    mistura unidades: se o produto tem lotes em KG e em MT, é preciso dizer qual.
//  • "Próprio ou de terceiro" vem do dono do lote: lote de CLIENTE é material
//    de terceiro (entra como third_party_in, sai como third_party_out); lote da
//    Tapajós ou de fornecedor (insumo comprado) é próprio (own).
//
// `db` é o PrismaService ou o cliente de uma transação ($transaction): quem
// chama decide a transação, e tudo acontece dentro dela.
// ─────────────────────────────────────────────────────────────────────────────

type Db = any

export const RESIDUO = new Decimal('0.005')

/** Arredonda para 2 casas (meio para cima). */
export function q2(v: Decimal.Value): Decimal {
  return new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/** Unidade efetiva do lote: a do lote, ou a do produto quando o lote não tem. */
export function unidadeDoLote(lot: { unit?: string | null; product?: { unit?: string | null } | null }): string | null {
  return (lot.unit ?? lot.product?.unit ?? null)?.trim() || null
}

const mesmaUnidade = (a: string | null, b: string | null) =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase()

/** Lote de cliente = material de terceiro. Fornecedor e Tapajós = próprio. */
export async function ehLoteDeCliente(db: Db, empresaId: string | null | undefined): Promise<boolean> {
  if (!empresaId) return false
  const c = await db.customer.findUnique({ where: { id: empresaId }, select: { id: true } })
  return !!c
}

export type MovimentoInfo = {
  note?: string | null
  reference?: string | null
  occurredAt?: Date
  customerId?: string | null
  supplierId?: string | null
  pairId?: string | null
  unitCost?: Decimal.Value | null
  receiptImagePath?: string | null
}

export type Consumo = { lotId: string; lot: any; qty: Decimal; unit: string | null; movementId: string }

/**
 * Baixa `quantity` dos lotes e grava um movimento de saída por lote.
 * - `lotId`: baixa só deste lote (ação feita a partir da linha do lote)
 * - sem `lotId`: FIFO entre os lotes do produto/depósito, filtrando por
 *   `empresaId` (dono) e `unit` quando informados
 */
export async function consumirLotes(db: Db, p: {
  tenantId: string
  companyId: string
  productId: string
  warehouseId?: string | null
  quantity: Decimal.Value
  lotId?: string | null
  empresaId?: string | null
  unit?: string | null
  movimento?: MovimentoInfo
}): Promise<{ consumos: Consumo[]; unit: string | null; total: Decimal }> {
  const total = q2(p.quantity)
  if (!total.isFinite() || total.lte(0)) throw new BadRequestException('Quantidade inválida')

  let lots: any[]
  if (p.lotId) {
    const lot = await db.stockLot.findFirst({
      where: { id: p.lotId, tenantId: p.tenantId, companyId: p.companyId },
      include: { product: { select: { unit: true, name: true } } },
    })
    if (!lot) throw new BadRequestException('Lote não encontrado')
    if (lot.productId !== p.productId) throw new BadRequestException('O lote informado é de outro produto')
    if (p.warehouseId && lot.warehouseId !== p.warehouseId) throw new BadRequestException('O lote informado está em outro depósito')
    lots = [lot]
  } else {
    if (!p.warehouseId) throw new BadRequestException('Depósito não informado')
    const where: any = {
      tenantId: p.tenantId, companyId: p.companyId,
      productId: p.productId, warehouseId: p.warehouseId,
      qtyRemaining: { gte: RESIDUO },
    }
    if (p.empresaId) where.empresaId = p.empresaId
    lots = await db.stockLot.findMany({
      where,
      include: { product: { select: { unit: true, name: true } } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    })
    if (p.unit) {
      lots = lots.filter(l => mesmaUnidade(unidadeDoLote(l), p.unit!))
    } else {
      const unidades = [...new Set(lots.map(l => (unidadeDoLote(l) ?? '?').toUpperCase()))]
      if (unidades.length > 1) {
        throw new BadRequestException(
          `Este produto tem lotes em unidades diferentes (${unidades.join(', ')}). ` +
          `Faça a saída a partir do lote desejado ou informe a unidade.`,
        )
      }
    }
  }

  // Saldo exato dos lotes (NF importada pode ter 4 casas); o pedido tem 2 casas,
  // então aceita diferença de até meio centésimo (RESIDUO)
  const disponivel = lots.reduce((acc, l) => acc.add(new Decimal(l.qtyRemaining)), new Decimal(0))
  if (disponivel.add(RESIDUO).lt(total)) {
    const un = p.unit ?? unidadeDoLote(lots[0] ?? {}) ?? ''
    throw new BadRequestException(`Estoque insuficiente: disponível ${disponivel.toFixed(2)} ${un}, solicitado ${total.toFixed(2)} ${un}`.trim())
  }

  const consumos: Consumo[] = []
  let restante = total
  for (const lot of lots) {
    if (restante.lt(RESIDUO)) break
    const saldo = new Decimal(lot.qtyRemaining)
    // Se o que falta é praticamente o saldo do lote, baixa o saldo exato
    // (zera o lote sem deixar resíduo nem ficar negativo)
    const qty = restante.sub(saldo).abs().lt(RESIDUO) || restante.gt(saldo) ? saldo : restante
    if (qty.lte(0)) continue
    const unit = unidadeDoLote(lot)
    const deCliente = await ehLoteDeCliente(db, lot.empresaId)

    await db.stockLot.update({ where: { id: lot.id }, data: { qtyRemaining: { decrement: qty } } })
    const mov = await db.stockMovement.create({
      data: {
        tenantId: p.tenantId, companyId: p.companyId,
        warehouseId: lot.warehouseId, productId: lot.productId,
        type: 'out', qty, unit, lotId: lot.id,
        ownership: deCliente ? 'third_party_out' : 'own',
        customerId: p.movimento?.customerId ?? (deCliente ? lot.empresaId : null),
        supplierId: p.movimento?.supplierId ?? null,
        pairId: p.movimento?.pairId ?? null,
        reference: p.movimento?.reference ?? null,
        note: p.movimento?.note ?? null,
        occurredAt: p.movimento?.occurredAt ?? new Date(),
        unitCost: p.movimento?.unitCost ?? null,
      },
    })
    consumos.push({ lotId: lot.id, lot, qty, unit, movementId: mov.id })
    restante = restante.sub(qty)
  }

  // total = o que de fato saiu dos lotes (pode diferir do pedido em < 0,005)
  const baixado = consumos.reduce((acc, c) => acc.add(c.qty), new Decimal(0))
  return { consumos, unit: consumos[0]?.unit ?? null, total: baixado }
}

/** Cria um lote e o movimento de entrada correspondente. */
export async function criarLote(db: Db, p: {
  tenantId: string
  companyId: string
  productId: string
  warehouseId: string
  empresaId: string
  processo: string
  unit: string | null
  quantity: Decimal.Value
  reference?: string | null
  occurredAt: Date
  nfeImportId?: string | null
  movimento?: MovimentoInfo
  casas?: number // casas decimais da quantidade (padrão 2; NF importada usa 4, como o qCom)
}): Promise<{ lot: any; movementId: string }> {
  const qty = new Decimal(p.quantity).toDecimalPlaces(p.casas ?? 2, Decimal.ROUND_HALF_UP)
  if (!qty.isFinite() || qty.lte(0)) throw new BadRequestException('Quantidade inválida')
  const deCliente = await ehLoteDeCliente(db, p.empresaId)

  const lot = await db.stockLot.create({
    data: {
      tenantId: p.tenantId, companyId: p.companyId,
      productId: p.productId, warehouseId: p.warehouseId,
      empresaId: p.empresaId, processo: p.processo, unit: p.unit,
      reference: p.reference ?? null, occurredAt: p.occurredAt,
      nfeImportId: p.nfeImportId ?? null,
      qtyInitial: qty, qtyRemaining: qty,
    },
  })
  const mov = await db.stockMovement.create({
    data: {
      tenantId: p.tenantId, companyId: p.companyId,
      warehouseId: p.warehouseId, productId: p.productId,
      type: 'in', qty, unit: p.unit, lotId: lot.id,
      ownership: deCliente ? 'third_party_in' : 'own',
      customerId: p.movimento?.customerId ?? (deCliente ? p.empresaId : null),
      supplierId: p.movimento?.supplierId ?? null,
      pairId: p.movimento?.pairId ?? null,
      reference: p.movimento?.reference ?? p.reference ?? null,
      note: p.movimento?.note ?? null,
      occurredAt: p.movimento?.occurredAt ?? new Date(),
      unitCost: p.movimento?.unitCost ?? null,
      receiptImagePath: p.movimento?.receiptImagePath ?? null,
    },
  })
  return { lot, movementId: mov.id }
}

/**
 * Devolve ao lote o que um movimento de saída tirou (cancelamento de NF,
 * exclusão de rascunho). Usa `lotId`; para movimentos antigos sem a coluna,
 * lê o id do texto "lote <id>" da observação.
 */
export async function estornarSaida(db: Db, mov: any, p: { reference: string; note: string }): Promise<string | null> {
  const lotId: string | null = mov.lotId ?? mov.note?.match(/lote ([0-9a-f-]{36})/)?.[1] ?? null
  if (lotId) {
    await db.stockLot.update({ where: { id: lotId }, data: { qtyRemaining: { increment: mov.qty } } })
  }
  await db.stockMovement.create({
    data: {
      tenantId: mov.tenantId, companyId: mov.companyId,
      warehouseId: mov.warehouseId, productId: mov.productId,
      type: 'in', qty: mov.qty, unit: mov.unit ?? null, lotId,
      ownership: mov.ownership === 'third_party_out' ? 'third_party_in' : mov.ownership,
      customerId: mov.customerId, supplierId: mov.supplierId,
      occurredAt: new Date(),
      reference: p.reference,
      note: `${p.note} - lote ${lotId ?? 'desconhecido'}`,
    },
  })
  return lotId
}
