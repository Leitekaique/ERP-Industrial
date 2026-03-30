import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePayables, useReceivables, useBillings } from '../../lib/useApi'
import { PageHeader } from '../../components/ui/PageHeader'

type SortKey = 'tipo' | 'data' | 'contraparte' | 'valor' | 'status'
type SortDir = 'asc' | 'desc'
const PAGE_SIZE = 50

function brl(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type MovRow = {
  id: string
  tipo: 'receber' | 'pagar' | 'fatura'
  data: string       // dueDate ou billing month
  contraparte: string
  valor: number
  status: string
  ref?: string
  paidAt?: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Em aberto', paid: 'Pago', canceled: 'Cancelado',
  sent: 'Enviado', overdue: 'Vencido', partial: 'Parcial',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  canceled: 'bg-gray-100 text-gray-500',
  sent: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-700',
  partial: 'bg-orange-100 text-orange-700',
}

const TIPO_COLORS: Record<string, string> = {
  receber: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pagar: 'bg-red-50 text-red-700 border border-red-200',
  fatura: 'bg-purple-50 text-purple-700 border border-purple-200',
}

const TIPO_LABELS: Record<string, string> = {
  receber: 'A Receber',
  pagar: 'A Pagar',
  fatura: 'Fatura',
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function FinanceiroHistoricoPage() {
  const nav = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receber' | 'pagar' | 'fatura'>('todos')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [applied, setApplied] = useState({ from: '', to: '', tipo: 'todos' as typeof tipoFiltro, status: '' })
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('data')
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

  const { data: receivables = [] } = useReceivables({
    from: applied.from || undefined,
    to: applied.to || undefined,
    status: applied.status as any || undefined,
  })
  const { data: payables = [] } = usePayables({
    from: applied.from || undefined,
    to: applied.to || undefined,
    status: applied.status as any || undefined,
  })
  const { data: billings = [] } = useBillings({
    status: applied.status || undefined,
  })

  const rows = useMemo<MovRow[]>(() => {
    const result: MovRow[] = []

    if (applied.tipo === 'todos' || applied.tipo === 'receber') {
      receivables.forEach((r: any) => {
        const lastPay = r.payments?.length > 0 ? r.payments[r.payments.length - 1] : null
        result.push({
          id: r.id, tipo: 'receber',
          data: r.dueDate,
          contraparte: r.customer?.name ?? r.customerId ?? '—',
          valor: Number(r.amount),
          status: r.status,
          ref: r.nfeId ? `NF vinculada` : undefined,
          paidAt: lastPay?.paidAt ?? r.billing?.paidAt ?? undefined,
        })
      })
    }

    if (applied.tipo === 'todos' || applied.tipo === 'pagar') {
      payables.forEach((p: any) => {
        const lastPay = p.payments?.length > 0 ? p.payments[p.payments.length - 1] : null
        result.push({
          id: p.id, tipo: 'pagar',
          data: p.dueDate,
          contraparte: p.supplier?.name ?? p.supplierId ?? '—',
          valor: Number(p.amount),
          status: p.status,
          paidAt: lastPay?.paidAt ?? undefined,
        })
      })
    }

    if (applied.tipo === 'todos' || applied.tipo === 'fatura') {
      billings.forEach((b: any) => {
        const mesLabel = b.dueDate
          ? new Date(b.dueDate).toLocaleDateString('pt-BR')
          : `${MESES[(b.month ?? 1) - 1]}/${b.year}`
        result.push({
          id: b.id, tipo: 'fatura',
          data: b.dueDate ?? b.sentAt ?? `${b.year}-${String(b.month).padStart(2, '0')}-01`,
          contraparte: b.customer?.name ?? b.customerId ?? '—',
          valor: Number(b.totalAmount),
          status: b.status,
          ref: `Fatura ${b.billingNumber ?? ''} — ${mesLabel}`,
          paidAt: b.paidAt ?? undefined,
        })
      })
    }

    // apply text search
    const q = search.trim().toLowerCase()
    const filtered = q
      ? result.filter(r =>
          TIPO_LABELS[r.tipo].toLowerCase().includes(q) ||
          new Date(r.data).toLocaleDateString('pt-BR').includes(q) ||
          r.contraparte.toLowerCase().includes(q) ||
          (r.ref ?? '').toLowerCase().includes(q) ||
          (STATUS_LABELS[r.status] ?? r.status).toLowerCase().includes(q) ||
          String(r.valor).includes(q)
        )
      : result

    // apply sort
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'tipo') cmp = TIPO_LABELS[a.tipo].localeCompare(TIPO_LABELS[b.tipo])
      else if (sortKey === 'data') cmp = new Date(a.data).getTime() - new Date(b.data).getTime()
      else if (sortKey === 'contraparte') cmp = a.contraparte.localeCompare(b.contraparte)
      else if (sortKey === 'valor') cmp = a.valor - b.valor
      else if (sortKey === 'status') cmp = (STATUS_LABELS[a.status] ?? a.status).localeCompare(STATUS_LABELS[b.status] ?? b.status)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [receivables, payables, billings, applied.tipo, search, sortKey, sortDir])

  const pageCount = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totais = useMemo(() => {
    const entradas = rows.filter(r => r.tipo === 'receber').reduce((acc, r) => acc + r.valor, 0)
    const saidas = rows.filter(r => r.tipo === 'pagar').reduce((acc, r) => acc + r.valor, 0)
    const faturas = rows.filter(r => r.tipo === 'fatura').reduce((acc, r) => acc + r.valor, 0)
    return { entradas, saidas, saldo: entradas - saidas, faturas }
  }, [rows])

  function applyFilters() {
    setApplied({ from, to, tipo: tipoFiltro, status: statusFiltro })
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Histórico Financeiro" sub="Visão consolidada de recebíveis, pagáveis e faturas">
        <button className="px-3 py-2 border rounded text-sm bg-white" onClick={() => nav(-1)}>Voltar</button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="block text-sm text-gray-600">Tipo</span>
          <select className="border rounded px-2 py-2" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value as any)}>
            <option value="todos">Todos</option>
            <option value="receber">A Receber</option>
            <option value="pagar">A Pagar</option>
            <option value="fatura">Faturas</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">Status</span>
          <select className="border rounded px-2 py-2" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
            <option value="">(Todos)</option>
            <option value="open">Em aberto</option>
            <option value="paid">Pago</option>
            <option value="canceled">Cancelado</option>
            <option value="sent">Enviado</option>
            <option value="overdue">Vencido</option>
          </select>
        </div>
        <div>
          <span className="block text-sm text-gray-600">De</span>
          <input type="date" className="border rounded px-2 py-2" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm text-gray-600">Até</span>
          <input type="date" className="border rounded px-2 py-2" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm" onClick={applyFilters}>Filtrar</button>
        <div>
          <span className="block text-sm text-gray-600">Busca</span>
          <input
            type="text"
            className="border rounded px-2 py-2 text-sm w-48"
            placeholder="Filtrar todas colunas…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Entradas (a receber)" value={brl(totais.entradas)} color="text-emerald-700" />
        <SummaryCard label="Saídas (a pagar)" value={brl(totais.saidas)} color="text-red-700" />
        <SummaryCard label="Saldo líquido" value={brl(totais.saldo)} color={totais.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'} />
        <SummaryCard label="Faturas" value={brl(totais.faturas)} color="text-purple-700" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {([ ['tipo','Tipo'], ['data','Vencimento'], ['contraparte','Contraparte'] ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort(key)}>
                  {label}<SortIcon col={key} />
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Pago em</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Referência</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('valor')}>
                Valor<SortIcon col="valor" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('status')}>
                Status<SortIcon col="status" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedRows.length === 0 && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {pagedRows.map(r => (
              <tr key={`${r.tipo}-${r.id}`} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[r.tipo]}`}>
                    {TIPO_LABELS[r.tipo]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {new Date(r.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium">{r.contraparte}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {r.paidAt ? new Date(r.paidAt).toLocaleDateString('pt-BR') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{r.ref ?? '—'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.tipo === 'pagar' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {r.tipo === 'pagar' ? '−' : '+'}{brl(r.valor)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">Página {page + 1} de {pageCount} ({rows.length} registros)</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <button className="px-3 py-1.5 border rounded text-sm disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${color ?? ''}`}>{value}</div>
    </div>
  )
}
