import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAddReceivablePayment, useCancelReceivable, useReceivables, useReceivablePayments, useReceiveBillingFull } from '../../lib/useApi'
import { downloadCSV } from '../../lib/csv'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge, RECEIVABLE_STATUS, BILLING_STATUS } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

function brl(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Params = { status?: 'open'|'paid'|'canceled'; from?: string; to?: string; q?: string }
type SortKey = 'vencimento' | 'cliente' | 'valor' | 'status'
type SortDir = 'asc' | 'desc'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const PAGE_SIZE = 50

export default function ReceivablesList() {
  const nav = useNavigate()
  const [status, setStatus] = useState<'open'|'paid'|'canceled'|''>('open')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState<Params>({ status: 'open' })
  const [sortKey, setSortKey] = useState<SortKey>('vencimento')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc'); setPage(0) }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-0.5 text-slate-300">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const params = useMemo(() => ({
    status: applied.status || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
  }), [applied])

  const { data, isLoading, error, refetch } = useReceivables(params)
  const list = data ?? []

  // Expandir linhas de fatura para ver itens individuais
  const [expandedBillings, setExpandedBillings] = useState<Set<string>>(new Set())

  function toggleBilling(billingId: string) {
    setExpandedBillings(prev => {
      const next = new Set(prev)
      if (next.has(billingId)) next.delete(billingId)
      else next.add(billingId)
      return next
    })
  }

  // Totalizadores da lista atual
  const totals = useMemo(() => {
    const sum = (arr: typeof list, st?: string) =>
      arr.filter(r => (st ? r.status === st : true))
         .reduce((acc, r) => acc + Number(r.amount || 0), 0)
    return {
      all: sum(list),
      open: sum(list, 'open'),
      paid: sum(list, 'paid'),
      canceled: sum(list, 'canceled'),
    }
  }, [list])

  // Agrupar por billingId
  const { billingGroups, standalone } = useMemo(() => {
    const grouped = new Map<string, typeof list>()
    const ungrouped: typeof list = []

    for (const r of list) {
      const b = (r as any).billing
      if (b) {
        const key = b.id
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(r)
      } else {
        ungrouped.push(r)
      }
    }

    return {
      billingGroups: Array.from(grouped.entries()).map(([billingId, items]) => ({
        billingId,
        billing: (items[0] as any).billing,
        customerName: (items[0] as any).customer?.name ?? items[0].customerId,
        items,
        total: items.reduce((acc, r) => acc + Number(r.amount || 0), 0),
      })),
      standalone: ungrouped,
    }
  }, [list])

  type DisplayRow =
    | { _type: 'group'; billingId: string; billing: any; customerName: string; items: any[]; total: number }
    | { _type: 'standalone' } & (typeof list)[0]

  const { displayRows, totalRows } = useMemo(() => {
    const getDate = (row: DisplayRow) => row._type === 'group'
      ? (row.billing.dueDate ?? `${row.billing.year}-${String(row.billing.month).padStart(2,'0')}-01`)
      : (row as any).dueDate
    const getName = (row: DisplayRow) => row._type === 'group' ? row.customerName : ((row as any).customer?.name ?? '')
    const getVal = (row: DisplayRow) => row._type === 'group' ? row.total : Number((row as any).amount)
    const getSt = (row: DisplayRow) => row._type === 'group' ? row.billing.status : (row as any).status

    const all: DisplayRow[] = [
      ...billingGroups.map(g => ({ _type: 'group' as const, ...g })),
      ...standalone.map(s => ({ _type: 'standalone' as const, ...s } as DisplayRow)),
    ]
    const sorted = [...all].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'vencimento') cmp = new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
      else if (sortKey === 'cliente') cmp = getName(a).localeCompare(getName(b))
      else if (sortKey === 'valor') cmp = getVal(a) - getVal(b)
      else if (sortKey === 'status') cmp = getSt(a).localeCompare(getSt(b))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return { displayRows: sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), totalRows: sorted.length }
  }, [billingGroups, standalone, sortKey, sortDir, page])

  const pageCount = Math.ceil(totalRows / PAGE_SIZE)

  const pay = useAddReceivablePayment()
  const cancel = useCancelReceivable()
  const receiveBilling = useReceiveBillingFull()

  const [payingId, setPayingId] = useState('')
  const [viewId, setViewId] = useState('') // modal "ver"
  const [receivingBillingId, setReceivingBillingId] = useState('') // baixa fatura completa

  function apply() {
    setApplied({ status: status || undefined, from, to })
    setPage(0)
    refetch()
  }

  function exportCSV() {
    const rows = list.map(r => ({
      id: r.id,
      dueDate: new Date(r.dueDate).toLocaleDateString('pt-BR'),
      amount: Number(r.amount),
      status: r.status,
      cliente: (r as any).customer?.name ?? r.customerId,
      fatura: (r as any).billing?.billingNumber ?? '',
      createdAt: new Date(r.createdAt).toLocaleString('pt-BR'),
    }))
    downloadCSV('receivables', rows)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Contas a Receber" sub="Títulos e recebimentos">
        <button className="px-3 py-2 bg-gray-200 rounded text-sm" onClick={exportCSV}>Exportar CSV</button>
        <button className="px-3 py-2 border rounded text-sm bg-white" onClick={() => nav('/financeiro/historico')}>Histórico Geral</button>
        <Link to="/receivables/new" className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm">Nova fatura</Link>
      </PageHeader>

      {/* filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="block text-sm text-gray-600">Status</span>
          <select className="border rounded px-2 py-2" value={status} onChange={e=>setStatus(e.target.value as any)}>
            <option value="">(Todos)</option>
            <option value="open">Em aberto</option>
            <option value="paid">Pago</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">De</span>
          <input type="date" className="border rounded px-2 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Até</span>
          <input type="date" className="border rounded px-2 py-2" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <button className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm" onClick={apply}>Filtrar</button>
      </div>

      {/* totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Total (lista)" value={brl(totals.all)} />
        <Card title="Em aberto" value={brl(totals.open)} />
        <Card title="Pagos" value={brl(totals.paid)} />
        <Card title="Cancelados" value={brl(totals.canceled)} />
      </div>

      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">Erro ao carregar.</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('vencimento')}>Vencimento<SortIcon col="vencimento" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago em</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('cliente')}>Cliente<SortIcon col="cliente" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">NF-e</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('valor')}>Valor<SortIcon col="valor" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('status')}>Status<SortIcon col="status" /></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">

            {displayRows.map(row => {
              if (row._type === 'group') {
                const group = row
                const b = group.billing
                const isExpanded = expandedBillings.has(group.billingId)
                const dueDate = b.dueDate ? new Date(b.dueDate).toLocaleDateString('pt-BR') : `${MESES[(b.month ?? 1) - 1]}/${b.year}`
                return [
                  <tr key={`billing-${group.billingId}`} className="bg-blue-50 hover:bg-blue-100 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{dueDate}</td>
                    <td className="px-4 py-3 text-slate-400">—</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{group.customerName}</div>
                      <div className="text-xs text-blue-600 font-medium">Fatura #{b.billingNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-blue-600">
                      {(() => {
                        const allNfs = [...new Set(group.items.flatMap((r: any) => {
                          if (r.nfeNumbers) return r.nfeNumbers.split(',').map((s: string) => s.trim()).filter(Boolean)
                          return r.nfe ? [String(r.nfe.number ?? '')] : []
                        }))]
                        return allNfs.length > 0 ? allNfs.map(n => `NF-e ${n}`).join(', ') : `${group.items.length} item(ns)`
                      })()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{brl(group.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} map={BILLING_STATUS} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {b.status !== 'paid' && b.status !== 'canceled' && (
                          <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium" onClick={() => setReceivingBillingId(group.billingId)}>Receber Fatura</button>
                        )}
                        <button className="text-xs text-blue-600 hover:text-blue-800 font-medium" onClick={() => toggleBilling(group.billingId)}>
                          {isExpanded ? 'Recolher' : 'Expandir'}
                        </button>
                      </div>
                    </td>
                  </tr>,
                  ...(isExpanded ? group.items.map((r: any) => (
                    <tr key={r.id} className="bg-blue-50/50 border-l-4 border-l-blue-300 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-2 pl-8 text-slate-600">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2 text-slate-400">
                        {r.payments?.length > 0
                          ? new Date(r.payments[r.payments.length - 1].paidAt).toLocaleDateString('pt-BR')
                          : r.billing?.paidAt ? new Date(r.billing.paidAt).toLocaleDateString('pt-BR')
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600 text-xs italic">item da fatura</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {r.nfeNumbers
                          ? <span className="font-medium text-slate-700">{r.nfeNumbers.split(',').map((n: string) => `NF-e ${n.trim()}`).join(', ')}</span>
                          : r.nfe ? <span className="font-medium text-slate-700">NF-e {r.nfe.number ?? ''}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{brl(r.amount)}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} map={RECEIVABLE_STATUS} /></td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button className="text-xs text-slate-500 hover:text-slate-700 font-medium" onClick={() => setViewId(r.id)}>Histórico</button>
                          {r.status === 'open' && <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium" onClick={() => setPayingId(r.id)}>Receber</button>}
                        </div>
                      </td>
                    </tr>
                  )) : [])
                ]
              }
              const r = row as any
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.payments?.length > 0
                      ? new Date(r.payments[r.payments.length - 1].paidAt).toLocaleDateString('pt-BR')
                      : r.billing?.paidAt ? new Date(r.billing.paidAt).toLocaleDateString('pt-BR')
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{r.customer?.name ?? r.customerId}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.nfeNumbers
                      ? <span className="font-medium text-slate-700">{r.nfeNumbers.split(',').map((n: string) => `NF-e ${n.trim()}`).join(', ')}</span>
                      : r.nfe ? <span className="font-medium text-slate-700">NF-e {r.nfe.number ?? ''}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-semibold">{brl(r.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} map={RECEIVABLE_STATUS} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium" onClick={() => nav(`/receivables/${r.id}`)}>Editar</button>
                      <button className="text-xs text-slate-500 hover:text-slate-700 font-medium" onClick={() => setViewId(r.id)}>Histórico</button>
                      {r.status === 'open' && (
                        <>
                          <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium" onClick={() => setPayingId(r.id)}>Receber</button>
                          <button className="text-xs text-red-500 hover:text-red-700 font-medium" onClick={async () => { await cancel.mutateAsync(r.id) }}>Cancelar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {list.length === 0 && !isLoading && <EmptyState message="Nenhuma fatura encontrada" colSpan={7} />}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">Página {page + 1} de {pageCount} ({totalRows} registros)</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* receber inline (item individual) */}
      {payingId && (
        <ReceiveInline
          onClose={()=>setPayingId('')}
          onConfirm={async({paidAt, amount, method, reference, note})=>{
            await pay.mutateAsync({ id: payingId, paidAt, amount, method, reference, note })
            setPayingId('')
          }}
        />
      )}

      {/* receber fatura completa */}
      {receivingBillingId && (
        <ReceiveBillingInline
          onClose={() => setReceivingBillingId('')}
          onConfirm={async ({ paidAt, method, note }) => {
            await receiveBilling.mutateAsync({ id: receivingBillingId, paidAt, method, note })
            setReceivingBillingId('')
          }}
        />
      )}

      {/* modal ver */}
      {viewId && <ViewReceivable id={viewId} onClose={()=>setViewId('')} />}
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function ReceiveInline({
  onClose, onConfirm
}:{
  onClose: ()=>void
  onConfirm: (p:{ paidAt?:string; amount:number; method?:string; reference?:string; note?:string })=>Promise<any>
}) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('pix')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  async function confirm() {
    setErr('')
    const num = Number(amount)
    if (!amount || Number.isNaN(num) || num<=0) { setErr('Informe um valor válido (> 0).'); return }
    try {
      await onConfirm({ paidAt, amount: num, method, reference: reference||undefined, note: note||undefined })
    } catch (e:any) {
      const msg = e?.response?.data?.message || e?.message || 'Falha ao registrar recebimento.'
      setErr(String(msg))
    }
  }

  return (
    <div className="border rounded p-3 space-y-2 bg-gray-50">
      <div className="grid grid-cols-5 gap-3">
        <div>
          <span className="block text-sm text-gray-600">Recebido em</span>
          <input type="date" className="border rounded px-2 py-2 w-full" value={paidAt} onChange={e=>setPaidAt(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Valor</span>
          <input type="number" step="0.01" className="border rounded px-2 py-2 w-full" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Método</span>
          <select className="border rounded px-2 py-2 w-full" value={method} onChange={e=>setMethod(e.target.value)}>
            <option value="pix">PIX</option>
            <option value="transfer">Transferência</option>
            <option value="boleto">Boleto</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Ref.</span>
          <input className="border rounded px-2 py-2 w-full" value={reference} onChange={e=>setReference(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Obs.</span>
          <input className="border rounded px-2 py-2 w-full" value={note} onChange={e=>setNote(e.target.value)} />
        </div>
      </div>
      {err && <div className="text-red-700 text-sm">{err}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-2 bg-black text-white rounded" onClick={confirm}>Confirmar recebimento</button>
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}

function ViewReceivable({ id, onClose }:{ id:string; onClose:()=>void }) {
  const { data: payments, isLoading, error } = useReceivablePayments(id)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Fatura {id.slice(0,8)}…</h3>
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>Fechar</button>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600 mb-2">Histórico de pagamentos</div>
          {isLoading && <div>Carregando…</div>}
          {error && <div className="text-red-600">Erro ao carregar.</div>}
          {(!payments || payments.length===0) && !isLoading && <div className="text-gray-500">Sem pagamentos.</div>}
          {payments && payments.length>0 && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Pago em</th>
                  <th className="p-2 text-left">Valor</th>
                  <th className="p-2 text-left">Método</th>
                  <th className="p-2 text-left">Ref.</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{new Date(p.paidAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-2">{brl(p.amount)}</td>
                    <td className="p-2">{p.method ?? '-'}</td>
                    <td className="p-2">{p.reference ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function ReceiveBillingInline({
  onClose, onConfirm
}: {
  onClose: () => void
  onConfirm: (p: { paidAt?: string; method?: string; note?: string }) => Promise<any>
}) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('pix')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  async function confirm() {
    setErr('')
    try {
      await onConfirm({ paidAt, method, note: note || undefined })
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Falha ao registrar recebimento.')
    }
  }

  return (
    <div className="border-2 border-emerald-300 rounded p-4 space-y-3 bg-emerald-50">
      <div className="font-medium text-emerald-800 text-sm">Receber fatura completa — todos os itens serão marcados como pagos</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="block text-sm text-gray-600">Recebido em</span>
          <input type="date" className="border rounded px-2 py-2 w-full" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Método</span>
          <select className="border rounded px-2 py-2 w-full" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="pix">PIX</option>
            <option value="transfer">Transferência</option>
            <option value="boleto">Boleto</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Obs.</span>
          <input className="border rounded px-2 py-2 w-full" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
      {err && <div className="text-red-700 text-sm">{err}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-2 bg-emerald-700 text-white rounded text-sm" onClick={confirm}>Confirmar recebimento</button>
        <button className="px-3 py-2 bg-gray-200 rounded text-sm" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
