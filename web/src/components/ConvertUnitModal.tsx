import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useEmpresasOrigem } from '../lib/useEmpresasOrigem'
import { SearchableSelect } from './ui/SearchableSelect'

type ConvertUnitModalProps = {
  data: {
    tenantId: string
    companyId: string
    productId: string
    productName: string
    warehouseId: string
    unit: string
    onHand: number
    empresaId?: string
  }
  onClose: () => void
  onSuccess?: () => void
}

export function ConvertUnitModal({ data, onClose, onSuccess }: ConvertUnitModalProps) {
  const [modo, setModo] = useState<'largura' | 'fator'>('largura')
  const [quantidadeOriginal, setQuantidadeOriginal] = useState('')
  const [largura, setLargura] = useState('')
  const [fator, setFator] = useState('')
  const [unitDestino, setUnitDestino] = useState('M')
  const [empresaDestinoId, setEmpresaDestinoId] = useState(data.companyId)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const { data: empresas = [] } = useEmpresasOrigem({ tenantId: data.tenantId, companyId: data.companyId })

  const quantidadeFinal = useMemo(() => {
    const q = Number(quantidadeOriginal)
    if (!q || q <= 0) return ''
    if (modo === 'largura') {
      const l = Number(largura)
      if (!l || l <= 0) return ''
      return (Math.round(q / l * 100) / 100).toFixed(2)
    } else {
      const f = Number(fator)
      if (!f || f <= 0) return ''
      return (Math.round(q * f * 100) / 100).toFixed(2)
    }
  }, [quantidadeOriginal, largura, fator, modo])

  async function submit() {
    setErro('')
    const q = Number(quantidadeOriginal)
    if (!q || q <= 0 || q > data.onHand) {
      setErro(`Quantidade inválida (máx: ${data.onHand})`)
      return
    }
    if (!unitDestino.trim()) {
      setErro('Informe a unidade destino')
      return
    }
    if (modo === 'largura') {
      const l = Number(largura)
      if (!l || l <= 0) { setErro('Informe a largura em metros (> 0)'); return }
    } else {
      const f = Number(fator)
      if (!f || f <= 0) { setErro('Informe o fator de conversão (> 0)'); return }
    }

    setLoading(true)
    try {
      await api.post('/inventory/stock/convert-unit', {
        tenantId: data.tenantId,
        companyId: data.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        unitDestino,
        quantity: q,
        ...(modo === 'largura'
          ? { largura: Number(largura) }
          : { factor: Number(fator) }),
        note: modo === 'largura'
          ? `Conv. ${data.unit}→${unitDestino} (largura ${largura}m)`
          : `Conv. ${data.unit}→${unitDestino} (fator ${fator})`,
        empresaDestinoId,
        ...(data.empresaId ? { empresaOrigemId: data.empresaId } : {}),
      })
      onSuccess?.()
      onClose()
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erro ao converter unidade'
      setErro(Array.isArray(msg) ? msg.join(' | ') : String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[460px] shadow-xl">

        <div className="px-5 py-4 border-b border-slate-200 rounded-t-xl">
          <h2 className="font-semibold text-slate-800">Converter unidade</h2>
          <p className="text-sm text-slate-500 mt-0.5">{data.productName}</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">

          {/* Modo */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button
              type="button"
              className={`flex-1 py-2 font-medium transition-colors ${modo === 'largura' ? 'bg-tapajos-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setModo('largura')}
            >
              Por largura (m² ÷ M)
            </button>
            <button
              type="button"
              className={`flex-1 py-2 font-medium transition-colors ${modo === 'fator' ? 'bg-tapajos-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setModo('fator')}
            >
              Fator manual
            </button>
          </div>

          {/* Quantidade origem */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantidade ({data.unit})
            </label>
            <input
              type="number"
              step="0.0001"
              className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-tapajos-500"
              value={quantidadeOriginal}
              onChange={e => setQuantidadeOriginal(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-400 mt-0.5">Disponível: {data.onHand} {data.unit}</p>
          </div>

          {/* Parâmetro de conversão */}
          {modo === 'largura' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Largura do tecido (m)
              </label>
              <input
                type="number"
                step="0.01"
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-tapajos-500"
                value={largura}
                onChange={e => setLargura(e.target.value)}
                placeholder="Ex: 1.50"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Fórmula: m² ÷ largura = metros lineares
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fator de conversão
              </label>
              <input
                type="number"
                step="0.000001"
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-tapajos-500"
                value={fator}
                onChange={e => setFator(e.target.value)}
                placeholder="Ex: 0.5"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Fórmula: quantidade × fator = resultado
              </p>
            </div>
          )}

          {/* Preview */}
          {quantidadeFinal && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">Resultado da conversão</p>
              <p className="text-lg font-semibold text-slate-800">
                {quantidadeFinal} {unitDestino || '—'}
              </p>
              {modo === 'largura' && largura && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {quantidadeOriginal} {data.unit} ÷ {largura} m = {quantidadeFinal} {unitDestino}
                </p>
              )}
            </div>
          )}

          {/* Unidade destino */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unidade destino
            </label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-tapajos-500"
              value={unitDestino}
              onChange={e => setUnitDestino(e.target.value.toUpperCase())}
              placeholder="Ex: M, KG, UN"
            />
          </div>

          {/* Empresa destino */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Empresa destino
            </label>
            <SearchableSelect
              value={empresaDestinoId}
              onChange={setEmpresaDestinoId}
              placeholder="Selecione a empresa destino"
              options={(empresas as any[])
                .filter(e => e.id !== data.companyId)
                .map(e => ({ value: e.id, label: e.name }))}
              pinnedOptions={(empresas as any[])
                .filter(e => e.id === data.companyId)
                .map(e => ({ value: e.id, label: `${e.name} (Tapajós)` }))}
            />
          </div>

          {erro && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
              {erro}
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 rounded-b-xl flex gap-2">
          <button
            className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700 disabled:opacity-50"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Convertendo…' : 'Converter'}
          </button>
          <button
            className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
