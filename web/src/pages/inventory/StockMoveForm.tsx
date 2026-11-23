import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { api } from '../../lib/api'
import { useProducts, useWarehouses } from '../../lib/useApi'
import { useEmpresasOrigem } from '../../lib/useEmpresasOrigem'
import { SearchableSelect } from '../../components/ui/SearchableSelect'

export default function StockMoveForm() {
  const tenantId = 'T-001'
  const companyId = 'C-001'

  const nav = useNavigate()
  const location = useLocation()
  const { productId } = useParams<{ productId: string }>()

  const { data: products = [] } = useProducts()
  const { data: warehouses = [] } = useWarehouses()
  const { data: empresas = [] } = useEmpresasOrigem({ tenantId, companyId })

  const [selectedProductId, setSelectedProductId] = useState(productId ?? '')
  const [type, setType] = useState<'in' | 'out'>(
    location.state?.fromList ? 'out' : 'in',
  )
  const [warehouseId, setWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [empresaOrigemId, setEmpresaOrigemId] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [generateCharge, setGenerateCharge] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const localISO = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  const [occurredAt, setOccurredAt] = useState(localISO)

  useEffect(() => {
    if (location.state?.unit) setUnit(location.state.unit)
    if (location.state?.empresaOrigemId) setEmpresaOrigemId(location.state.empresaOrigemId)
  }, [location.state])

  useEffect(() => {
    if (!selectedProductId || !products.length) return
    const p = products.find((p: any) => p.id === selectedProductId)
    if (p) {
      setUnit(prev => prev || p.unit)
      setEmpresaOrigemId(prev => prev || p.empresaId || '')
    }
  }, [selectedProductId, products])

  useEffect(() => {
    if (!warehouseId && warehouses.length === 1) setWarehouseId((warehouses[0] as any).id)
  }, [warehouses, warehouseId])

  // Produto selecionado — para avisos inline
  const selectedProduct = products.find((p: any) => p.id === selectedProductId) as any | undefined
  const chargeWillBeSkipped = generateCharge && type === 'out' && selectedProduct && !selectedProduct.customerId

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setReceiptFile(file)
    setReceiptPreview(file ? URL.createObjectURL(file) : null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!selectedProductId || !warehouseId || !quantity) {
      setSubmitError('Preencha produto, depósito e quantidade.')
      return
    }

    setSubmitting(true)
    try {
      let receiptImagePath: string | undefined
      if (receiptFile) {
        const fd = new FormData()
        fd.append('file', receiptFile)
        const res = await api.post('/inventory/stock/upload-receipt', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        receiptImagePath = res.data?.imagePath
      }

      await api.post('/inventory/stock/move', {
        tenantId,
        companyId,
        productId: selectedProductId,
        warehouseId,
        type,
        quantity: Math.round(Number(quantity) * 100) / 100,
        unit,
        empresaOrigemId,
        reference: reference.trim() || undefined,
        occurredAt: new Date(occurredAt),
        note,
        ...(receiptImagePath ? { receiptImagePath } : {}),
        ...(type === 'out' ? { generateCharge } : {}),
      })

      nav('/inventory/stock')
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Erro ao registrar movimentação.'
      setSubmitError(Array.isArray(msg) ? msg.join(' | ') : String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const productOptions = (products as any[])
    .map(p => ({
      value: p.id,
      label: `${p.sku} — ${p.name}`,
      sublabel: p.empresaOrigem?.name ?? undefined,
    }))

  return (
    <form className="max-w-xl space-y-3" onSubmit={submit}>
      <h2 className="text-xl font-semibold">Movimentar estoque</h2>

      {submitError && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded px-4 py-3 text-sm">
          {submitError}
        </div>
      )}

      <FormField label="Produto">
        <SearchableSelect
          value={selectedProductId}
          onChange={setSelectedProductId}
          placeholder="— Selecione o produto —"
          emptyLabel="— Selecione o produto —"
          options={productOptions}
        />
      </FormField>

      <FormField label="Tipo">
        <select
          className="border rounded px-3 py-2 w-full"
          value={type}
          onChange={e => setType(e.target.value as 'in' | 'out')}
        >
          <option value="out">Saída</option>
          <option value="in">Entrada</option>
        </select>
      </FormField>

      <FormField label="Depósito">
        <select
          className="border rounded px-3 py-2 w-full"
          value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)}
          required
        >
          <option value="">Selecionar</option>
          {(warehouses as any[]).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Unidade">
          <input
            className="border rounded px-3 py-2 w-full bg-gray-100"
            value={unit}
            disabled
          />
        </FormField>
        <FormField label="Quantidade">
          <input
            type="number"
            step="0.000001"
            className="border rounded px-3 py-2 w-full"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            required
          />
        </FormField>
      </div>

      <FormField label="Empresa origem">
        <input
          className="border rounded px-3 py-2 w-full bg-gray-100"
          value={(empresas as any[]).find(e => e.id === empresaOrigemId)?.name ?? '—'}
          disabled
        />
      </FormField>

      <FormField label="Referência / NF" hint="Número de NF, romaneio ou outra referência para rastrear a origem">
        <input
          type="text"
          className="border rounded px-3 py-2 w-full"
          placeholder="Ex.: 1-006089, Romaneio 3240…"
          value={reference}
          onChange={e => setReference(e.target.value)}
        />
      </FormField>

      <FormField label="Data do evento">
        <input
          type="datetime-local"
          className="border rounded px-3 py-2 w-full"
          value={occurredAt}
          onChange={e => setOccurredAt(e.target.value)}
        />
      </FormField>

      <FormField label="Observação">
        <textarea
          className="border rounded px-3 py-2 w-full"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </FormField>

      {type === 'out' && (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded"
              checked={generateCharge}
              onChange={e => setGenerateCharge(e.target.checked)}
            />
            <span>
              Gerar cobrança{' '}
              <span className="text-slate-400 font-normal">(cria A Receber com preço × qtd conforme prazo do cliente)</span>
            </span>
          </label>
          {chargeWillBeSkipped && (
            <p className="text-xs text-amber-600 ml-6">
              Produto sem cliente vinculado — nenhuma cobrança será gerada.
            </p>
          )}
        </div>
      )}

      {type === 'in' && (
        <FormField label="Foto do romaneio (opcional)">
          <input
            type="file"
            accept="image/*"
            className="block text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            onChange={handleReceiptChange}
          />
          {receiptPreview && (
            <img
              src={receiptPreview}
              alt="Pré-visualização do romaneio"
              className="mt-2 max-h-48 rounded border"
            />
          )}
        </FormField>
      )}

      <div className="flex gap-2 pt-3">
        <button
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Salvando...' : 'Confirmar'}
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-gray-200 rounded"
          onClick={() => nav('/inventory/stock')}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
