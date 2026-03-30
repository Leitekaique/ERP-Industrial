import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAddReceivablePayment, useCancelReceivable, useReceivables, useReceivablePayments } from '../../lib/useApi'
import { downloadCSV } from '../../lib/csv'

function brl(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Params = { status?: 'open'|'paid'|'canceled'; from?: string; to?: string; q?: string }

export default function ReceivablesList() {
  const [status, setStatus] = useState<'open'|'paid'|'canceled'|''>('open')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState<Params>({ status: 'open' })

  const params = useMemo(() => ({
    status: applied.status || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
  }), [applied])

  const { data, isLoading, error, refetch } = useReceivables(params)
  const list = data ?? []

  // totalizadores da lista atual
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

  const pay = useAddReceivablePayment()
  const cancel = useCancelReceivable()

  const [payingId, setPayingId] = useState('')
  const [viewId, setViewId] = useState('') // modal "ver"

  function apply() {
    setApplied({ status: status || undefined, from, to })
    refetch()
  }

  function exportCSV() {
    const rows = list.map(r => ({
      id: r.id,
      dueDate: new Date(r.dueDate).toLocaleDateString('pt-BR'),
      amount: Number(r.amount),
      status: r.status,
      customerId: r.customerId,
      createdAt: new Date(r.createdAt).toLocaleString('pt-BR'),
    }))
    downloadCSV('receivables', rows)
  }

  return (
    <div className="space-y-4">
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
        <button className="px-3 py-2 bg-black text-white rounded" onClick={apply}>Filtrar</button>

        <div className="flex-1" />
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={exportCSV}>Exportar CSV</button>
        <Link to="/receivables/new" className="px-3 py-2 bg-green-600 text-white rounded">Nova fatura</Link>
      </div>

      {/* totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Total (lista)" value={brl(totals.all)} />
        <Card title="Em aberto" value={brl(totals.open)} />
        <Card title="Pagos" value={brl(totals.paid)} />
        <Card title="Cancelados" value={brl(totals.canceled)} />
      </div>

      {isLoading && <p>Carregando...</p>}
      {error && <p className="text-red-600">Erro ao carregar.</p>}

      <table className="w-full border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Vencimento</th>
            <th className="p-2 text-left">Cliente</th>
            <th className="p-2 text-left">Valor</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
              <td className="p-2">{r.customerId}</td>
              <td className="p-2">{brl(r.amount)}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2 flex gap-3">
                <button className="text-blue-700 hover:underline" onClick={()=>setViewId(r.id)}>ver</button>
                {r.status === 'open' && (
                  <>
                    <button className="text-green-700 hover:underline" onClick={() => setPayingId(r.id)}>receber</button>
                    <button className="text-red-700 hover:underline" onClick={async ()=>{ await cancel.mutateAsync(r.id) }}>cancelar</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {list.length===0 && !isLoading && (
            <tr><td className="p-4 text-center text-gray-500" colSpan={5}>Nenhuma fatura</td></tr>
          )}
        </tbody>
      </table>

      {/* receber inline */}
      {payingId && (
        <ReceiveInline
          onClose={()=>setPayingId('')}
          onConfirm={async({paidAt, amount, method, reference, note})=>{
            await pay.mutateAsync({ id: payingId, paidAt, amount, method, reference, note })
            setPayingId('')
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
