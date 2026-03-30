import React, { useEffect, useState } from 'react'
import { useCreateReceivable, useReceivable, useCustomers } from '../../lib/useApi'
import { useNavigate, useParams } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/ui/PageHeader'

export default function ReceivableForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const editing = !!id

  const { data: receivable, isLoading } = useReceivable(id)
  const { data: customers } = useCustomers()
  const create = useCreateReceivable()

  const [customerId, setCustomerId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (editing && receivable) {
      setCustomerId(receivable.customerId ?? '')
      setDueDate(receivable.dueDate?.slice(0, 10) ?? '')
      setAmount(String(receivable.amount ?? ''))
      setMethod((receivable as any).paymentMethod ?? '')
    }
  }, [editing, receivable])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const num = Number(amount)
    if (!customerId) { setErr('Selecione um cliente.'); return }
    if (!dueDate) { setErr('Informe a data de vencimento.'); return }
    if (!amount || Number.isNaN(num) || num <= 0) { setErr('Informe um valor válido (> 0).'); return }
    try {
      await create.mutateAsync({ customerId, dueDate, amount: num, method, note })
      nav('/receivables')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erro ao criar recebível.'
      setErr(Array.isArray(msg) ? msg.join(' | ') : String(msg))
    }
  }

  if (editing && isLoading) return <p className="text-sm text-slate-500 p-4">Carregando...</p>

  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader
        title={editing ? 'Editar conta a receber' : 'Nova conta a receber'}
        sub="Registrar título de recebimento manual"
      />

      <form className="bg-white rounded-xl border border-slate-200 overflow-hidden" onSubmit={submit}>
        <div className="p-6 space-y-4">

          <FormField label="Cliente *">
            <select
              className="border rounded px-3 py-2 w-full"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              required
            >
              <option value="">Selecione um cliente</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Data de vencimento *">
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Valor (R$) *">
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="border rounded px-3 py-2 w-full"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField label="Forma de pagamento">
            <select
              className="border rounded px-3 py-2 w-full"
              value={method}
              onChange={e => setMethod(e.target.value)}
            >
              <option value="">— Selecione —</option>
              <option value="pix">PIX</option>
              <option value="transfer">Transferência bancária</option>
              <option value="boleto">Boleto</option>
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
            </select>
          </FormField>

          <FormField label="NF / Romaneio (referência)" hint="Número da NF-e ou romaneio que gerou este recebimento (texto livre)">
            <input
              type="text"
              className="border rounded px-3 py-2 w-full"
              placeholder="Ex.: NF-e 6089, Romaneio 3240, Fatura ABC…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </FormField>

          {err && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
              {err}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button
            className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700 disabled:opacity-50"
            type="submit"
            disabled={create.isPending}
          >
            {create.isPending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar recebível'}
          </button>
          <button
            className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
            type="button"
            onClick={() => nav('/receivables')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
