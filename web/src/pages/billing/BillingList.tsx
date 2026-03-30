import { useMemo, useState } from 'react'

type SortKey = 'numero' | 'periodo' | 'cliente' | 'total' | 'status'
type SortDir = 'asc' | 'desc'
const PAGE_SIZE = 50
import { useNavigate } from 'react-router-dom'
import {
  useBillings,
  useGenerateBilling,
  useSendBilling,
  useMarkBillingPaid,
  useCancelBilling,
  useCustomers,
  useUnbilledReceivables,
} from '../../lib/useApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge, BILLING_STATUS } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { api } from '../../lib/api'

async function downloadBillingPdf(billingId: string, faturaNum: string | number) {
  try {
    const res = await api.get(`/billing/${billingId}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `duplicata-${faturaNum}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    alert('Erro ao baixar PDF da duplicata.')
  }
}

function brl(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function BillingList() {
  const nav = useNavigate()
  const now = new Date()
  const [viewBilling, setViewBilling] = useState<any | null>(null)
  const [status, setStatus] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(0) // 0 = todos
  const [sortKey, setSortKey] = useState<SortKey>('periodo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc'); setPage(0) }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-0.5 text-slate-300">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const [applied, setApplied] = useState({
    status: '', customerId: '', year: now.getFullYear(), month: 0,
  })

  const params = useMemo(() => ({
    status: applied.status || undefined,
    customerId: applied.customerId || undefined,
    year: applied.year || undefined,
    month: applied.month || undefined,
  }), [applied])

  const { data, isLoading, error, refetch } = useBillings(params)
  const { data: customers } = useCustomers('')
  const { data: unbilled } = useUnbilledReceivables()
  const generate = useGenerateBilling()
  const send = useSendBilling()
  const paid = useMarkBillingPaid()
  const cancel = useCancelBilling()

  // Painel de geração de nova fatura
  const [showGenerate, setShowGenerate] = useState(false)
  const [genCustomerId, setGenCustomerId] = useState('')
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1)
  const [genYear, setGenYear] = useState(now.getFullYear())
  const [genError, setGenError] = useState('')

  async function handleGenerate() {
    setGenError('')
    if (!genCustomerId) { setGenError('Selecione um cliente.'); return }
    try {
      await generate.mutateAsync({ customerId: genCustomerId, month: genMonth, year: genYear })
      setShowGenerate(false)
      refetch()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao gerar fatura.'
      setGenError(String(msg))
    }
  }

  const list = data ?? []

  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'numero') cmp = (a.billingNumber ?? 0) - (b.billingNumber ?? 0)
      else if (sortKey === 'periodo') cmp = new Date(a.dueDate ?? `${a.year}-${String(a.month).padStart(2,'0')}-01`).getTime() - new Date(b.dueDate ?? `${b.year}-${String(b.month).padStart(2,'0')}-01`).getTime()
      else if (sortKey === 'cliente') cmp = (a.customer?.name ?? '').localeCompare(b.customer?.name ?? '')
      else if (sortKey === 'total') cmp = Number(a.totalAmount) - Number(b.totalAmount)
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, sortKey, sortDir])

  const pageCount = Math.ceil(sortedList.length / PAGE_SIZE)
  const pagedList = sortedList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Totalizadores da lista atual
  const totais = useMemo(() => {
    const soma = (st?: string) =>
      list.filter(b => !st || b.status === st).reduce((acc, b) => acc + Number(b.totalAmount), 0)
    return { total: soma(), aberto: soma('open'), enviado: soma('sent'), pago: soma('paid'), vencido: soma('overdue') }
  }, [list])

  return (
    <div className="space-y-4">
      <PageHeader title="Faturamento" sub="Faturas mensais por cliente">
        <button className="px-3 py-2 border rounded text-sm bg-white" onClick={() => nav('/financeiro/historico')}>Histórico Geral</button>
        <button
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm"
          onClick={() => setShowGenerate(!showGenerate)}
        >
          Gerar fatura
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="block text-sm text-gray-600">Status</span>
          <select className="border rounded px-2 py-2" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">(Todos)</option>
            <option value="open">Em aberto</option>
            <option value="sent">Enviado</option>
            <option value="paid">Pago</option>
            <option value="overdue">Vencido</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Cliente</span>
          <select className="border rounded px-2 py-2 w-64" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">(Todos)</option>
            {(customers ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Ano</span>
          <input type="number" className="border rounded px-2 py-2 w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Mês</span>
          <select className="border rounded px-2 py-2" value={month} onChange={e => setMonth(Number(e.target.value))}>
            <option value={0}>(Todos)</option>
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <button
          className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm"
          onClick={() => { setApplied({ status, customerId, year, month }); refetch() }}
        >
          Filtrar
        </button>
      </div>

      {/* Painel de geração */}
      {showGenerate && (
        <div className="border rounded p-4 bg-gray-50 space-y-3">
          <p className="font-medium">Gerar fatura mensal</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-sm text-gray-600">Cliente</span>
              <select className="border rounded px-2 py-2 w-full" value={genCustomerId} onChange={e => setGenCustomerId(e.target.value)}>
                <option value="">Selecione...</option>
                {(customers ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-sm text-gray-600">Mês</span>
              <select className="border rounded px-2 py-2 w-full" value={genMonth} onChange={e => setGenMonth(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-sm text-gray-600">Ano</span>
              <input type="number" className="border rounded px-2 py-2 w-full" value={genYear} onChange={e => setGenYear(Number(e.target.value))} />
            </div>
          </div>
          {genError && <p className="text-red-700 text-sm">{genError}</p>}
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-black text-white rounded" onClick={handleGenerate} disabled={generate.isPending}>
              {generate.isPending ? 'Gerando...' : 'Gerar'}
            </button>
            <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => { setShowGenerate(false); setGenError('') }}>
              Cancelar
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Agrupa todos os recebíveis em aberto do cliente no mês selecionado em uma única fatura.
            Recebíveis já vinculados a outra fatura não são incluídos.
          </p>
        </div>
      )}

      {/* Totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card title="Total (lista)" value={brl(totais.total)} />
        <Card title="Em aberto" value={brl(totais.aberto)} />
        <Card title="Enviados" value={brl(totais.enviado)} />
        <Card title="Pagos" value={brl(totais.pago)} />
        <Card title="Vencidos" value={brl(totais.vencido)} color="text-red-600" />
      </div>

      {/* Recebíveis sem fatura (a12) */}
      {unbilled && unbilled.length > 0 && (
        <div className="border rounded-lg bg-amber-50 border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">NFs emitidas sem fatura gerada</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-amber-700 border-b border-amber-200">
                <th className="pb-1">Cliente</th>
                <th className="pb-1">NFs</th>
                <th className="pb-1 text-right">Títulos</th>
                <th className="pb-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {unbilled.map(u => (
                <tr key={u.customerId} className="border-t border-amber-100">
                  <td className="py-1 text-amber-900 font-medium">{u.customerName}</td>
                  <td className="py-1 text-amber-700 text-xs">
                    {u.nfs && u.nfs.length > 0
                      ? u.nfs.map(n => `NF-e ${n}`).join(', ')
                      : <span className="italic text-amber-500">Sem NF vinculada</span>}
                  </td>
                  <td className="py-1 text-right text-amber-700">{u.count}</td>
                  <td className="py-1 text-right text-amber-900 font-semibold">{brl(u.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">Erro ao carregar faturas.</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('numero')}>Fatura Nº<SortIcon col="numero" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('periodo')}>Período<SortIcon col="periodo" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('cliente')}>Cliente<SortIcon col="cliente" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Itens</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('total')}>Total<SortIcon col="total" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('status')}>Status<SortIcon col="status" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Enviado em</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedList.map(b => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700 font-mono font-medium">{b.billingNumber ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {new Date(b.dueDate).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium">{b.customer?.name ?? b.customerId}</td>
                <td className="px-4 py-3 text-slate-500">{b.receivables?.length ?? '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-semibold">{brl(b.totalAmount)}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} map={BILLING_STATUS} /></td>
                <td className="px-4 py-3 text-slate-500">
                  {b.sentAt ? new Date(b.sentAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {(b as any).paidAt ? new Date((b as any).paidAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                      onClick={() => setViewBilling(b)}
                    >
                      Ver
                    </button>
                    <button
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      title="Baixar PDF da duplicata"
                      onClick={() => downloadBillingPdf(b.id, b.billingNumber ?? b.id)}
                    >
                      PDF
                    </button>
                    {(b.status === 'open' || b.status === 'overdue') && (
                      <button className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium" onClick={async () => { await send.mutateAsync(b.id) }} disabled={send.isPending}>
                        Enviar
                      </button>
                    )}
                    {(b.status === 'sent' || b.status === 'overdue') && (
                      <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium" onClick={async () => { await paid.mutateAsync(b.id) }} disabled={paid.isPending}>
                        Fatura Paga
                      </button>
                    )}
                    {b.status !== 'paid' && (
                      <button className="text-xs text-red-500 hover:text-red-700 font-medium"
                        onClick={async () => {
                          if (!confirm('Desvincula os recebíveis e reseta a fatura. Continuar?')) return
                          await cancel.mutateAsync(b.id)
                        }}
                        disabled={cancel.isPending}
                      >
                        Desfazer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && !isLoading && <EmptyState message="Nenhuma fatura encontrada" colSpan={9} />}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">Página {page + 1} de {pageCount} ({sortedList.length} registros)</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>
      {viewBilling && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Fatura Nº {viewBilling.billingNumber} — {viewBilling.customer?.name ?? viewBilling.customerId}
              </h3>
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setViewBilling(null)}>Fechar</button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
              <div><span className="font-medium">Período:</span> {MESES[viewBilling.month - 1]}/{viewBilling.year}</div>
              <div><span className="font-medium">Total:</span> {brl(viewBilling.totalAmount)}</div>
              <div><span className="font-medium">Status:</span> {viewBilling.status}</div>
              {viewBilling.sentAt && <div><span className="font-medium">Enviado em:</span> {new Date(viewBilling.sentAt).toLocaleDateString('pt-BR')}</div>}
              {viewBilling.paidAt && <div className="text-emerald-700"><span className="font-medium">Pago em:</span> {new Date(viewBilling.paidAt).toLocaleDateString('pt-BR')}</div>}
            </div>
            <div className="border rounded p-3">
              <div className="text-sm font-medium text-slate-600 mb-2">Recebíveis vinculados ({viewBilling.receivables?.length ?? 0})</div>
              {(!viewBilling.receivables || viewBilling.receivables.length === 0)
                ? <div className="text-gray-500 text-sm">Nenhum.</div>
                : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Vencimento</th>
                        <th className="p-2 text-left">Valor</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewBilling.receivables.map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                          <td className="p-2">{brl(r.amount)}</td>
                          <td className="p-2">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${color ?? ''}`}>{value}</div>
    </div>
  )
}
