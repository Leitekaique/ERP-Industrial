import { useState } from 'react'
import { api } from '../../lib/api'

async function downloadEvento(eventoId: string, type: 'xml' | 'pdf', filename: string) {
  const res = await api.get(`/nfe-emit/eventos/${eventoId}/${type}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

interface Props {
  nfe: { id: string; number: any }
  onClose: () => void
  onSuccess: () => void
}

export default function CancelNfeModal({ nfe, onClose, onSuccess }: Props) {
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ eventoId: string } | null>(null)

  const minLen = 15
  const maxLen = 255
  const len = justificativa.trim().length

  async function handleConfirm() {
    if (len < minLen) {
      setError(`Justificativa deve ter pelo menos ${minLen} caracteres.`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/nfe-emit/${nfe.id}/cancel`, { justificativa })
      setResult({ eventoId: res.data.eventoId })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao cancelar NF-e.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const num = String(nfe.number).padStart(9, '0')
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">NF-e Cancelada</h2>
          </div>
          <p className="text-sm text-slate-600">
            A NF-e nº <strong>{nfe.number}</strong> foi cancelada. Um e-mail com o comprovante foi enviado automaticamente.
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              onClick={() => downloadEvento(result.eventoId, 'pdf', `cancel-nfe${num}.pdf`)}
            >
              Baixar PDF
            </button>
            <button
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              onClick={() => downloadEvento(result.eventoId, 'xml', `cancel-nfe${num}.xml`)}
            >
              Baixar XML
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              onClick={() => { onSuccess() }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-700">Cancelar NF-e nº {nfe.number}</h2>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
          <p className="font-medium">Atenção:</p>
          <ul className="list-disc list-inside space-y-0.5 text-red-600">
            <li>O cancelamento é irreversível.</li>
            <li>Prazo máximo: 24 horas após a autorização.</li>
            <li>A NF-e será marcada como cancelada na SEFAZ.</li>
          </ul>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Justificativa <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            rows={4}
            placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)..."
            value={justificativa}
            maxLength={maxLen}
            onChange={e => setJustificativa(e.target.value)}
            disabled={loading}
          />
          <p className={`text-xs text-right ${len < minLen ? 'text-red-500' : 'text-slate-400'}`}>
            {len}/{maxLen} caracteres
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Voltar
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            onClick={handleConfirm}
            disabled={loading || len < minLen}
          >
            {loading ? 'Cancelando…' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
