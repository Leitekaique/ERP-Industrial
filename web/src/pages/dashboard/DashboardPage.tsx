import { useState, useMemo, useRef, useEffect } from 'react'
import { useDashboard, useReceivables, usePayables, type DashboardSummary } from '../../lib/useApi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  FileText, AlertTriangle, DollarSign, Users, CreditCard, Landmark, Pencil, Check,
} from 'lucide-react'

const SALDO_KEY = 'erp_saldo_cc'

function useSaldoCC() {
  const [saldo, setSaldoState] = useState<number | null>(() => {
    const v = localStorage.getItem(SALDO_KEY)
    return v !== null ? Number(v) : null
  })
  const setSaldo = (v: number | null) => {
    if (v === null) localStorage.removeItem(SALDO_KEY)
    else localStorage.setItem(SALDO_KEY, String(v))
    setSaldoState(v)
  }
  return { saldo, setSaldo }
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number | null) {
  if (v === null) return null
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [applied, setApplied] = useState<{ mes: number; ano: number }>({
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  })

  const { data, isLoading, error, refetch } = useDashboard(applied.mes, applied.ano)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        Carregando dashboard...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-2 h-48 justify-center text-red-600">
        <AlertTriangle size={32} />
        <p>Erro ao carregar o dashboard.</p>
        <button className="px-3 py-1 bg-gray-200 rounded text-gray-700" onClick={() => refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <DashboardContent
      data={data}
      mes={mes} setMes={setMes}
      ano={ano} setAno={setAno}
      onApply={() => { setApplied({ mes, ano }); refetch() }}
    />
  )
}

// ─── Conteúdo ─────────────────────────────────────────────────────────────────

function DashboardContent({
  data, mes, setMes, ano, setAno, onApply,
}: {
  data: DashboardSummary
  mes: number; setMes: (v: number) => void
  ano: number; setAno: (v: number) => void
  onApply: () => void
}) {
  const { faturamento, recebiveis, payables, grafico, graficoQtd, graficoFluxo, topClientes, alertasBillings, periodo, tabelaProducao, ultimasTransacoes } = data
  const { saldo, setSaldo } = useSaldoCC()

  const variacaoFat = faturamento.variacao
  const VarIcon = variacaoFat === null ? Minus : variacaoFat >= 0 ? TrendingUp : TrendingDown
  const varColor = variacaoFat === null ? 'text-gray-400' : variacaoFat >= 0 ? 'text-green-600' : 'text-red-600'

  // ── Filtro de empresa (cliente) para os gráficos de 6 meses ─────────────────
  const clientesDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    topClientes.forEach(c => { if (c.customerId) map.set(c.customerId, c.name) })
    return Array.from(map.entries())
  }, [topClientes])

  const [clienteFiltro, setClienteFiltro] = useState('')

  const graficoFiltrado = useMemo(() => {
    if (!clienteFiltro) return grafico
    return grafico.map(g => ({
      ...g,
      total: g.porCliente.find(c => c.customerId === clienteFiltro)?.total ?? 0,
    }))
  }, [grafico, clienteFiltro])

  return (
    <div className="space-y-6">

      {/* Cabeçalho + seletor de período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumo executivo — {periodo.label}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Mês</span>
            <select
              className="border rounded px-2 py-1.5 text-sm"
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
            >
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Ano</span>
            <input
              type="number"
              className="border rounded px-2 py-1.5 text-sm w-20"
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
            />
          </div>
          <button
            className="px-3 py-1.5 bg-tapajos-600 text-white rounded text-sm"
            onClick={onApply}
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">

        {/* Faturamento do mês */}
        <KpiCard
          icon={<DollarSign size={22} className="text-tapajos-600" />}
          label="Faturamento do mês"
          value={brl(faturamento.atual)}
          sub={
            <span className={`flex items-center gap-1 ${varColor}`}>
              <VarIcon size={14} />
              {variacaoFat !== null
                ? `${pct(variacaoFat)} vs. mês anterior`
                : `Anterior: ${brl(faturamento.anterior)}`}
            </span>
          }
        />

        {/* NFs emitidas */}
        <KpiCard
          icon={<FileText size={22} className="text-blue-600" />}
          label="NFs emitidas"
          value={String(faturamento.nfsEmitidas)}
          sub={<span className="text-gray-400">Mês anterior: {faturamento.nfsEmitidasAnterior}</span>}
        />

        {/* A receber em aberto */}
        <KpiCard
          icon={<DollarSign size={22} className="text-amber-600" />}
          label="A receber (aberto)"
          value={brl(recebiveis.totalAberto)}
          sub={<span className="text-gray-400">{recebiveis.countAberto} título(s) no mês</span>}
        />

        {/* Recebíveis vencidos */}
        <KpiCard
          icon={<AlertTriangle size={22} className={recebiveis.countVencido > 0 ? 'text-red-600' : 'text-gray-400'} />}
          label="A receber vencido"
          value={brl(recebiveis.totalVencido)}
          sub={
            <span className={recebiveis.countVencido > 0 ? 'text-red-600' : 'text-gray-400'}>
              {recebiveis.countVencido} título(s) em atraso
            </span>
          }
          highlight={recebiveis.countVencido > 0}
        />

        {/* A pagar em aberto */}
        <KpiCard
          icon={<CreditCard size={22} className="text-purple-600" />}
          label="A pagar (aberto)"
          value={brl(payables?.totalAberto ?? 0)}
          sub={<span className="text-gray-400">{payables?.countAberto ?? 0} título(s) no mês</span>}
        />

        {/* Pagamentos vencidos */}
        <KpiCard
          icon={<AlertTriangle size={22} className={(payables?.countVencido ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'} />}
          label="A pagar vencido"
          value={brl(payables?.totalVencido ?? 0)}
          sub={
            <span className={(payables?.countVencido ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}>
              {payables?.countVencido ?? 0} título(s) em atraso
            </span>
          }
          highlight={(payables?.countVencido ?? 0) > 0}
        />

        {/* Saldo conta corrente */}
        <SaldoCard saldo={saldo} onSave={setSaldo} />
      </div>

      {/* Gráfico + Top Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Gráfico de faturamento — ocupa 2/3 da largura */}
        <div className="lg:col-span-2 border rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600">Faturamento — Últimos 6 meses</h2>
            <select
              className="border rounded px-2 py-1 text-xs text-gray-600"
              value={clienteFiltro}
              onChange={e => setClienteFiltro(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clientesDisponiveis.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          {graficoFiltrado.every(g => g.total === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Nenhuma NF autorizada nos últimos 6 meses.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={graficoFiltrado} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [brl(value as number), 'Faturamento']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="total" fill="#15803d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 5 clientes */}
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1">
            <Users size={14} /> Top clientes — {periodo.label}
          </h2>
          {topClientes.length === 0 ? (
            <p className="text-sm text-gray-400 mt-6 text-center">Nenhuma NF no mês.</p>
          ) : (
            <ul className="space-y-2">
              {topClientes.map((c, i) => (
                <li key={c.customerId ?? i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-tapajos-600 text-white text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm truncate" title={c.name}>{c.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold">{brl(c.totalFaturado)}</div>
                    <div className="text-xs text-gray-400">{c.totalNfs} NF(s)</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Gráficos adicionais: Quantidades e Fluxo de Caixa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Quantidades produzidas */}
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Quantidades produzidas — Últimos 6 meses</h2>
          {graficoQtd && graficoQtd.every(g => g.qtd === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem dados de quantidade.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={graficoQtd ?? []} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Quantidade']} />
                <Bar dataKey="qtd" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fluxo de Caixa */}
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Fluxo de Caixa — Últimos 6 meses</h2>
          {graficoFluxo && graficoFluxo.every(g => g.entradas === 0 && g.saidas === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem pagamentos registrados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={graficoFluxo ?? []} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => [brl(v as number), '']} />
                <Legend />
                <Line type="monotone" dataKey="entradas" stroke="#16a34a" strokeWidth={2} dot={false} name="Entradas" />
                <Line type="monotone" dataKey="saidas" stroke="#dc2626" strokeWidth={2} dot={false} name="Saídas" />
                <Line type="monotone" dataKey="saldo" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Alertas de Billings vencidos / pendentes */}
      {alertasBillings.length > 0 && (
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            Faturas pendentes / vencidas
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Período</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {alertasBillings.map(b => (
                <tr key={b.id} className="border-t">
                  <td className="py-2">{b.cliente}</td>
                  <td className="py-2">
                    {MESES[b.mes - 1]}/{b.ano}
                  </td>
                  <td className="py-2 font-medium">{brl(b.total)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      b.status === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status === 'overdue' ? 'Vencida' : 'Enviada'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela de Produção do mês */}
      {tabelaProducao && tabelaProducao.length > 0 && (
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Produção — {periodo.label}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2">Empresa</th>
                <th className="pb-2">Processo</th>
                <th className="pb-2 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {tabelaProducao.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5">{row.empresa}</td>
                  <td className="py-1.5 text-gray-600">{row.processo}</td>
                  <td className="py-1.5 text-right font-medium">
                    {Number(row.qtd).toLocaleString('pt-BR')} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Últimas Transações de Caixa */}
      {ultimasTransacoes && ultimasTransacoes.length > 0 && (
        <div className="border rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Últimas movimentações de caixa</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Data</th>
                <th className="pb-2">Contraparte</th>
                <th className="pb-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ultimasTransacoes.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="py-1.5 text-gray-500">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                  <td className="py-1.5">{t.contraparte}</td>
                  <td className={`py-1.5 text-right font-medium ${t.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                    {t.tipo === 'entrada' ? '+' : '−'} {brl(t.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Projeção de Caixa — próximos 3 meses */}
      <ProjecaoCaixa saldoAtual={saldo} />

    </div>
  )
}

// ─── Projeção de Caixa ────────────────────────────────────────────────────────

function ProjecaoCaixa({ saldoAtual }: { saldoAtual: number | null }) {
  const { data: recebiveis = [] } = useReceivables({ status: 'open' })
  const { data: pagaveis = [] } = usePayables({ status: 'open' })

  const projecao = useMemo(() => {
    const hoje = new Date()
    const meses: { label: string; entradas: number; saidas: number; saldo: number }[] = []
    let saldoAcc = saldoAtual ?? 0

    for (let i = 0; i < 3; i++) {
      const refDate = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const m = refDate.getMonth() + 1
      const a = refDate.getFullYear()
      const inicio = new Date(a, m - 1, 1)
      const fim = new Date(a, m, 0)

      const entradas = (recebiveis as any[])
        .filter((r: any) => {
          const d = new Date(r.dueDate)
          return d >= inicio && d <= fim
        })
        .reduce((acc: number, r: any) => acc + Number(r.amount ?? 0), 0)

      const saidas = (pagaveis as any[])
        .filter((p: any) => {
          const d = new Date(p.dueDate)
          return d >= inicio && d <= fim
        })
        .reduce((acc: number, p: any) => acc + Number(p.amount ?? 0), 0)

      saldoAcc = saldoAcc + entradas - saidas
      meses.push({
        label: `${MESES[m - 1]}/${a}`,
        entradas,
        saidas,
        saldo: saldoAcc,
      })
    }
    return meses
  }, [recebiveis, pagaveis, saldoAtual])

  if (projecao.every(m => m.entradas === 0 && m.saidas === 0)) return null

  return (
    <div className="border rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-600 mb-3">
        Projeção de Caixa — próximos 3 meses
        {saldoAtual === null && <span className="ml-2 text-xs text-amber-600 font-normal">(sem saldo CC configurado)</span>}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {projecao.map(m => (
          <div key={m.label} className="border rounded p-3 space-y-1">
            <div className="text-xs font-semibold text-gray-500">{m.label}</div>
            <div className="text-xs text-emerald-700">+ {brl(m.entradas)} entradas</div>
            <div className="text-xs text-red-700">− {brl(m.saidas)} saídas</div>
            <div className={`text-sm font-bold border-t pt-1 mt-1 ${m.saldo >= 0 ? 'text-sky-700' : 'text-red-700'}`}>
              {brl(m.saldo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Saldo Conta Corrente Card (editável, persiste em localStorage) ───────────

function SaldoCard({ saldo, onSave }: { saldo: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setRaw(saldo !== null ? String(saldo).replace('.', ',') : '')
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing])

  function confirm() {
    const parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(parsed)) onSave(parsed)
    setEditing(false)
  }

  return (
    <div className="border rounded-lg bg-white p-4 shadow-sm border-sky-200">
      <div className="flex items-start justify-between">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo CC</span>
        <Landmark size={22} className="text-sky-600" />
      </div>
      {editing ? (
        <div className="mt-2 flex items-center gap-1">
          <input
            ref={inputRef}
            className="border rounded px-2 py-1 text-sm w-full"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="0,00"
          />
          <button onClick={confirm} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
        </div>
      ) : (
        <div className="mt-2 flex items-end justify-between gap-1">
          <div className={`text-2xl font-bold ${saldo === null ? 'text-gray-300' : saldo >= 0 ? 'text-sky-700' : 'text-red-700'}`}>
            {saldo !== null ? brl(saldo) : '—'}
          </div>
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 mb-1">
            <Pencil size={13} />
          </button>
        </div>
      )}
      <div className="mt-1 text-xs text-gray-400">Atualizar manualmente</div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`border rounded-lg bg-white p-4 shadow-sm ${highlight ? 'border-red-300' : ''}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-800">{value}</div>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  )
}
