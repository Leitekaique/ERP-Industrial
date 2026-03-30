import { useState } from 'react'
import { useCreateReceivable } from '../../lib/useApi'
import { useNavigate } from 'react-router-dom'

export default function ReceivableForm() {
  const nav = useNavigate()
  const create = useCreateReceivable()

  // Use o ID que inserimos no banco via SQL
  const [customerId, setCustomerId] = useState('c1111111-1111-4111-8111-111111111111')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState<string>('0')
  const [method, setMethod] = useState('transfer')

  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')

    const num = Number(amount)
    if (!customerId.trim()) { setErr('Selecione/Informe um cliente válido.'); return }
    if (!dueDate) { setErr('Informe a data de vencimento.'); return }
    if (!Number.isFinite(num) || num <= 0) { setErr('Informe um valor > 0.'); return }

    try {
      await create.mutateAsync({ customerId, dueDate, amount: num, method })
      nav('/receivables')
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Falha ao criar fatura.'
      setErr(String(msg))
      console.error('create receivable error:', e?.response?.data || e)
    }
  }

  return (
    <form className="max-w-xl space-y-3" onSubmit={submit}>
      <h2 className="text-xl font-semibold">Nova fatura</h2>

      {err && <div className="text-red-700 text-sm">{err}</div>}

      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">Cliente (ID)</span>
        <input
          className="border rounded px-2 py-2 w-full"
          value={customerId}
          onChange={e=>setCustomerId(e.target.value)}
          placeholder="UUID do cliente"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm text-gray-600 mb-1">Vencimento</span>
          <input
            type="date"
            className="border rounded px-2 py-2 w-full"
            value={dueDate}
            onChange={e=>setDueDate(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="block text-sm text-gray-600 mb-1">Valor</span>
          <input
            type="number"
            step="0.01"
            className="border rounded px-2 py-2 w-full"
            value={amount}
            onChange={e=>setAmount(e.target.value)}
            placeholder="Ex.: 123.45"
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">Forma prevista</span>
        <select
          className="border rounded px-2 py-2 w-full"
          value={method}
          onChange={e=>setMethod(e.target.value)}
        >
          <option value="transfer">Transferência</option>
          <option value="pix">PIX</option>
          <option value="boleto">Boleto</option>
          <option value="cash">Dinheiro</option>
          <option value="card">Cartão</option>
        </select>
      </label>

      <div className="flex gap-2 pt-2">
        <button className="px-4 py-2 bg-black text-white rounded" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Criando...' : 'Criar'}
        </button>
        <button className="px-4 py-2 bg-gray-200 rounded" type="button" onClick={() => nav('/receivables')}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
