import React, { useEffect, useState } from 'react'
import { useCreatePayable, useSuppliers, usePayable, usePayableCategories, useAddPayableCategory, useRemovePayableCategory } from '../../lib/useApi'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { api } from '../../lib/api'

export default function PayableForm() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editing = !!id
  const create = useCreatePayable()
  const { data: existing } = usePayable(id)
  const { data: suppliers, isLoading } = useSuppliers('')

  const [supplierId, setSupplierId] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState<string>('0')
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer')
  const [nfeReceivedId, setNfeReceivedId] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const { data: categoriesData } = usePayableCategories()
  const addCategoryMutation = useAddPayableCategory()
  const removeCategoryMutation = useRemovePayableCategory()
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)
  const categories = categoriesData ?? []

  useEffect(() => {
    if (!supplierId && suppliers && suppliers.length > 0 && !editing) {
      setSupplierId(suppliers[0].id)
    }
  }, [suppliers])

  useEffect(() => {
    if (!existing) return
    setSupplierId(existing.supplierId ?? '')
    setDueDate(existing.dueDate ? new Date(existing.dueDate).toISOString().slice(0, 10) : '')
    setAmount(String(existing.amount ?? '0'))
    setPaymentMethod(existing.paymentMethod ?? 'transfer')
    setNfeReceivedId((existing as any)?.nfeReceivedId ?? '')
    setCategory((existing as any)?.category ?? '')
  }, [existing?.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/payables/${id}`, { supplierId, dueDate, amount: Number(amount), paymentMethod, nfeReceivedId: nfeReceivedId || undefined, category: category || null })
      } else {
        await create.mutateAsync({ supplierId, dueDate, amount: Number(amount), paymentMethod, nfeReceivedId: nfeReceivedId || undefined, category: category || undefined } as any)
      }
      nav('/payables')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader title={editing ? 'Editar título a pagar' : 'Novo título a pagar'} sub="Registrar conta a pagar a fornecedor" />

      <form className="bg-white rounded-xl border border-slate-200 overflow-hidden" onSubmit={submit}>
        <div className="p-6 space-y-4">
          {isLoading && <p className="text-sm text-slate-500">Carregando fornecedores...</p>}

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Fornecedor <span className="text-red-500">*</span></span>
            <select className="border rounded px-3 py-2 w-full" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
              {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Vencimento <span className="text-red-500">*</span></span>
              <input type="date" className="border rounded px-3 py-2 w-full" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) <span className="text-red-500">*</span></span>
              <input type="number" step="0.01" className="border rounded px-3 py-2 w-full" value={amount} onChange={e => setAmount(e.target.value)} required />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</span>
            <select className="border rounded px-3 py-2 w-full" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="transfer">Transferência</option>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
              Categoria
              <button type="button" className="text-xs text-tapajos-600 hover:underline" onClick={() => setShowCatManager(v => !v)}>
                {showCatManager ? 'Fechar' : 'Gerenciar categorias'}
              </button>
            </span>
            <select className="border rounded px-3 py-2 w-full" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Sem categoria —</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {showCatManager && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <p className="text-xs font-medium text-gray-600">Categorias personalizadas</p>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 text-sm flex-1"
                  placeholder="Nova categoria..."
                  value={newCategoryInput}
                  onChange={e => setNewCategoryInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newCategoryInput.trim()) { addCategoryMutation.mutate(newCategoryInput.trim()); setNewCategoryInput('') }
                    }
                  }}
                />
                <button
                  type="button"
                  className="px-3 py-1 bg-tapajos-600 text-white text-sm rounded hover:bg-tapajos-700"
                  onClick={() => { if (newCategoryInput.trim()) { addCategoryMutation.mutate(newCategoryInput.trim()); setNewCategoryInput('') } }}
                >
                  Adicionar
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {categories.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-gray-700">
                    {c}
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600 ml-0.5"
                      title={['Matéria prima','Frete / Transporte','Energia elétrica','Água e saneamento','Impostos e taxas','Serviços terceiros','Manutenção e reparo','Salários e benefícios','Equipamentos','Material de escritório','Outros'].includes(c) ? 'Categoria padrão — não pode ser removida' : 'Remover'}
                      disabled={['Matéria prima','Frete / Transporte','Energia elétrica','Água e saneamento','Impostos e taxas','Serviços terceiros','Manutenção e reparo','Salários e benefícios','Equipamentos','Material de escritório','Outros'].includes(c)}
                      onClick={() => removeCategoryMutation.mutate(c)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">NF de entrada (ID — opcional)</span>
            <input
              className="border rounded px-3 py-2 w-full font-mono text-sm"
              placeholder="ID da NF de entrada que gerou este título (opcional)"
              value={nfeReceivedId}
              onChange={e => setNfeReceivedId(e.target.value)}
            />
            <span className="block text-xs text-gray-400 mt-0.5">Preencha para vincular este título a uma NF de entrada importada.</span>
          </label>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar título'}
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50" type="button" onClick={() => nav('/payables')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
