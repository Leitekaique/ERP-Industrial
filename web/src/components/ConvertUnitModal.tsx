import { useMemo, useState } from 'react'
import { api } from '../lib/api'

type ConvertUnitModalProps = {
  data: {
    tenantId: string
    companyId: string
    productId: string
    productName: string
    warehouseId: string
    unit: string
    onHand: number
  }
  onClose: () => void
  onSuccess?: () => void
}

export function ConvertUnitModal({
  data,
  onClose,
  onSuccess,
}: ConvertUnitModalProps) {
  const [quantidadeOriginal, setQuantidadeOriginal] = useState('')
  const [fator, setFator] = useState('')
  const [empresaDestinoId, setEmpresaDestinoId] = useState(data.companyId)
  const [loading, setLoading] = useState(false)
  const [unitDestino, setUnitDestino] = useState('')


  const quantidadeFinal = useMemo(() => {
    const q = Number(quantidadeOriginal)
    const f = Number(fator)
    if (!q || !f) return ''
    return (Math.ceil(q * f * 100) / 100).toFixed(2)
  }, [quantidadeOriginal, fator])

  async function submit() {
    const q = Number(quantidadeOriginal)
    const f = Number(fator)

    if (!q || q <= 0 || q > data.onHand) {
      alert('Quantidade inválida')
      return
    }

    if (!f || f <= 0) {
      alert('Fator inválido')
      return
    }

    setLoading(true)
const companyId = "C-001"
const resolvedEmpresaDestinoId =
  empresaDestinoId && typeof empresaDestinoId === 'string'
    ? empresaDestinoId
    : companyId

    try {
      await api.post('/inventory/stock/convert-unit', {
        tenantId: data.tenantId,
        companyId: data.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
		unitDestino,
        quantity: q,
        factor: f,
        note: 'Conv. unidade',
        empresaDestinoId: resolvedEmpresaDestinoId,
      })

      onSuccess?.()
      onClose()
    } catch {
      alert('Erro ao converter unidade')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-[420px] space-y-3">
        <h2 className="font-semibold text-lg">Converter unidade</h2>

        <p className="text-sm text-gray-600">
          Produto: <b>{data.productName}</b>
        </p>

        <div>
          <label className="text-sm">Unidade original</label>
          <input
            className="border rounded px-3 py-2 w-full bg-gray-100"
            value={data.unit}
            disabled
          />
        </div>

        <div>
          <label className="text-sm">Quantidade ({data.unit})</label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={quantidadeOriginal}
            onChange={e => setQuantidadeOriginal(e.target.value)}
          />
          <p className="text-xs text-gray-500">Máx: {data.onHand}</p>
        </div>
<div>
  <label className="text-sm">Unidade destino</label>
  <input
	type="string"
    className="border rounded px-3 py-2 w-full"
    value={unitDestino}
    onChange={e => setUnitDestino(e.target.value.toUpperCase())}
    placeholder="Ex: M, KG, UN"
  />
</div>

        <div>
          <label className="text-sm">Fator de conversão</label>
          <input
            type="number"
            step="0.000001"
            className="border rounded px-3 py-2 w-full"
            value={fator}
            onChange={e => setFator(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm">Quantidade final</label>
          <input
            className="border rounded px-3 py-2 w-full bg-gray-100"
            value={quantidadeFinal}
            disabled
          />
        </div>

        {/* 🔹 EMPRESA DESTINO */}
        <div>
          <label className="text-sm">Empresa destino</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={empresaDestinoId}
            onChange={e => setEmpresaDestinoId(e.target.value)}
          >
            <option value={data.companyId}>Tapajós</option>
            {/* futuramente: map de empresas */}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-3 py-1 border rounded"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-1 bg-black text-white rounded"
            onClick={submit}
            disabled={loading}
          >
            Converter
          </button>
        </div>
      </div>
    </div>
  )
}
