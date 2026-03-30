import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAddPayablePayment, useCancelPayable, usePayable, usePayables, useSuppliers, usePayableCategories } from '../../lib/useApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge, PAYABLE_STATUS } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

type SortKey = 'vencimento' | 'fornecedor' | 'valor' | 'categoria' | 'status'
type SortDir = 'asc' | 'desc'
const PAGE_SIZE = 50

function formatBRL(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PayablesList() {
  const nav = useNavigate()
  // filtros controlados
  const [status, setStatus] = useState<'open' | 'paid' | 'canceled' | ''>('open')
  const [supplierId, setSupplierId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [category, setCategory] = useState<string>('')
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

  // estado “aplicado” (só muda ao clicar Filtrar)
  const [applied, setApplied] = useState({
    status: 'open' as 'open' | 'paid' | 'canceled' | '',
    supplierId: '',
    from: '',
    to: '',
    category: '',
  })

  const queryParams = useMemo(() => ({
    status: applied.status || undefined,
    supplierId: applied.supplierId || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
    category: applied.category || undefined,
  }), [applied])

  const { data, isLoading, error, refetch } = usePayables(queryParams)
  const { data: suppliers } = useSuppliers('')
  const { data: categoriesData } = usePayableCategories()
  const categories = categoriesData ?? []

  const supMap = useMemo(() => new Map((suppliers ?? []).map(s => [s.id, s.name])), [suppliers])

  const addPayment = useAddPayablePayment()
  const cancelPayable = useCancelPayable()

  const [payingId, setPayingId] = useState<string>('')
  const [viewId, setViewId] = useState<string>('')

  const totals = useMemo(() => {
    const list = data ?? []
    const sum = (st?: string) =>
      list.filter(p => (st ? p.status === st : true)).reduce((acc, p) => acc + Number(p.amount || 0), 0)
    return {
      all: sum(),
      open: sum('open'),
      paid: sum('paid'),
      canceled: sum('canceled'),
    }
  }, [data])

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of data ?? []) {
      const cat = (p as any).category || 'Sem categoria'
      map.set(cat, (map.get(cat) ?? 0) + Number(p.amount || 0))
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [data])

  const sortedData = useMemo(() => {
    const list = data ?? []
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'vencimento') cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      else if (sortKey === 'fornecedor') cmp = (supMap.get(a.supplierId) ?? '').localeCompare(supMap.get(b.supplierId) ?? '')
      else if (sortKey === 'valor') cmp = Number(a.amount) - Number(b.amount)
      else if (sortKey === 'categoria') cmp = ((a as any).category ?? '').localeCompare((b as any).category ?? '')
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, supMap, sortKey, sortDir])

  const pageCount = Math.ceil(sortedData.length / PAGE_SIZE)
  const pagedData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const applyFilters = () => {
    setApplied({ status, supplierId, from, to, category })
    setPage(0)
    refetch()
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Contas a Pagar" sub="Títulos e pagamentos a fornecedores">
        <button className="px-3 py-2 border rounded text-sm bg-white" onClick={() => nav('/financeiro/historico')}>Histórico Geral</button>
        <Link to="/payables/new" className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm">Novo título</Link>
      </PageHeader>

      <div className="flex items-end gap-2">
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
          <span className="block text-sm text-gray-600">Fornecedor</span>
          <select className="border rounded px-2 py-2 w-72" value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
            <option value="">(Todos)</option>
            {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

        <div>
          <span className="block text-sm text-gray-600">Categoria</span>
          <select className="border rounded px-2 py-2 w-48" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">(Todas)</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm" onClick={applyFilters}>Filtrar</button>
      </div>

      {/* Totais por categoria */}
      {categoryTotals.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Gastos por categoria</h3>
          <div className="flex flex-wrap gap-2">
            {categoryTotals.map(([cat, val]) => (
              <div key={cat} className="border rounded px-3 py-1.5 text-sm">
                <span className="text-slate-500">{cat}:</span>{' '}
                <span className="font-semibold text-slate-800">{formatBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard title="Total (lista)" value={formatBRL(totals.all)} />
        <SummaryCard title="Em aberto" value={formatBRL(totals.open)} color="text-amber-700" />
        <SummaryCard title="Pagos" value={formatBRL(totals.paid)} color="text-emerald-700" />
        <SummaryCard title="Cancelados" value={formatBRL(totals.canceled)} color="text-slate-400" />
      </div>

      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">Erro ao carregar.</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('vencimento')}>Vencimento<SortIcon col="vencimento" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago em</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('fornecedor')}>Fornecedor<SortIcon col="fornecedor" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">NF entrada</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('valor')}>Valor<SortIcon col="valor" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('categoria')}>Categoria<SortIcon col="categoria" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Forma</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('status')}>Status<SortIcon col="status" /></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
          {pagedData.map(p => (
            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-700">{new Date(p.dueDate).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-3 text-slate-500">
                {(p.payments?.length ?? 0) > 0
                  ? new Date(p.payments![p.payments!.length - 1].paidAt).toLocaleDateString('pt-BR')
                  : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-900 font-medium">{supMap.get(p.supplierId) ?? p.supplierId}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">
                {(p as any).nfeReceived
                  ? <span className="font-mono font-medium text-slate-700">NF {String((p as any).nfeReceived.number).padStart(6,'0')}</span>
                  : (p as any).nfeReceivedId
                    ? <span className="font-mono text-slate-400">{String((p as any).nfeReceivedId).slice(0, 8)}…</span>
                    : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-900 font-semibold">{formatBRL(p.amount)}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{(p as any).category ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-3 text-slate-500">{p.paymentMethod ?? '—'}</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} map={PAYABLE_STATUS} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <button className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium" onClick={() => nav(`/payables/${p.id}`)}>Editar</button>
                  <button className="text-xs text-slate-500 hover:text-slate-700 font-medium" onClick={() => setViewId(p.id)}>Histórico</button>
                  {p.status === 'open' && (
                    <>
                      <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium" onClick={() => setPayingId(p.id)}>Pagar</button>
                      <button
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                        onClick={async () => { await cancelPayable.mutateAsync(p.id) }}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {(!data || data.length === 0) && !isLoading && <EmptyState message="Nenhum título encontrado" colSpan={8} />}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">Página {page + 1} de {pageCount} ({sortedData.length} registros)</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {payingId && (
        <PayInline
          onClose={() => setPayingId('')}
          onConfirm={async (payload) => {
            await addPayment.mutateAsync({ id: payingId, ...payload })
            setPayingId('')
          }}
        />
      )}

      {viewId && <ViewPayable id={viewId} onClose={() => setViewId('')} supMap={supMap} />}
    </div>
  )
}

function PayInline({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (p: {
    paidAt?: string
    amount?: number
    method?: string
    reference?: string
    note?: string
  }) => Promise<any>
}) {
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState<string>('') // agora vamos exigir preencher
  const [method, setMethod] = useState<string>('pix')
  const [reference, setReference] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const [err, setErr] = useState<string>('')

  async function confirm() {
    setErr('')
    const num = Number(amount)
    if (!amount || Number.isNaN(num) || num <= 0) {
      setErr('Informe um valor válido (> 0).')
      return
    }
    if (!method) {
      setErr('Selecione o método de pagamento.')
      return
    }
    try {
      await onConfirm({
        paidAt: paidAt || undefined,
        amount: num,
        method,
        reference: reference || undefined,
        note: note || undefined,
      })
    } catch (e: any) {
      const apiMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Falha ao registrar pagamento.'
      setErr(String(apiMsg))
    }
  }

  return (
    <div className="border rounded p-3 space-y-2 bg-gray-50">
      <div className="grid grid-cols-5 gap-3">
        <div>
          <span className="block text-sm text-gray-600">Pago em</span>
          <input type="date" className="border rounded px-2 py-2 w-full" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Valor</span>
          <input
            type="number"
            step="0.01"
            className="border rounded px-2 py-2 w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex.: 1234.56"
          />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Método</span>
          <select className="border rounded px-2 py-2 w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="pix">PIX</option>
            <option value="transfer">Transferência</option>
            <option value="boleto">Boleto</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Ref.</span>
          <input className="border rounded px-2 py-2 w-full" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Obs.</span>
          <input className="border rounded px-2 py-2 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {err && <div className="text-red-700 text-sm">{err}</div>}

      <div className="flex gap-2">
        <button className="px-3 py-2 bg-black text-white rounded" onClick={confirm}>
          Confirmar pagamento
        </button>
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}


function ViewPayable({ id, onClose, supMap }: { id: string; onClose: () => void; supMap: Map<string, string> }) {
  const { data: payable, isLoading } = usePayable(id)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Título — {payable ? supMap.get(payable.supplierId) ?? payable.supplierId : '...'}</h3>
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>Fechar</button>
        </div>
        {isLoading && <div className="text-sm text-slate-500">Carregando...</div>}
        {payable && (
          <div className="border rounded p-3 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 text-slate-600">
              <div><span className="font-medium">Vencimento:</span> {new Date(payable.dueDate).toLocaleDateString('pt-BR')}</div>
              <div><span className="font-medium">Valor:</span> R$ {Number(payable.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><span className="font-medium">Status:</span> {payable.status}</div>
            </div>
            <div className="text-slate-600 mt-2 font-medium">Pagamentos registrados</div>
            {(!payable.payments || payable.payments.length === 0) && <div className="text-gray-500">Sem pagamentos.</div>}
            {payable.payments && payable.payments.length > 0 && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Pago em</th>
                    <th className="p-2 text-left">Valor</th>
                    <th className="p-2 text-left">Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {payable.payments.map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{new Date(p.paidAt).toLocaleDateString('pt-BR')}</td>
                      <td className="p-2">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2">{p.reference ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${color ?? ''}`}>{value}</div>
    </div>
  )
}
