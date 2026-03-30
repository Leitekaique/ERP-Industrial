import { useParams, useNavigate } from 'react-router-dom'
import { useStockHistoryItem } from '../../lib/useApi' // ajuste o path se necessário

export default function StockHistoryPage() {
  const nav = useNavigate()
  const { productId } = useParams<{ productId: string }>()

  // 🔥 pegue do mesmo lugar que o resto do app pega
  const tenantId = 'T-001'
  const companyId = 'C-001'

  if (!productId) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-600">productId não informado na rota.</div>
        <button className="mt-3 px-3 py-1 border rounded" onClick={() => nav(-1)}>
          Voltar
        </button>
      </div>
    )
  }

  const { data = [], isLoading, error } = useStockHistoryItem({
    productId: productId!,
  })

  if (isLoading) return <div className="p-4">Carregando histórico...</div>

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-600">Erro ao carregar histórico.</div>
        <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(error, null, 2)}</pre>
        <button className="mt-3 px-3 py-1 border rounded" onClick={() => nav(-1)}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Histórico do Produto</h2>
        <button className="px-3 py-1 border rounded text-sm" onClick={() => nav(-1)}>
          Voltar
        </button>
      </div>

      {data.length === 0 && (
        <div className="text-sm text-gray-500">Nenhum evento encontrado para este produto.</div>
      )}

      {data.map((h: any) => (
        <div key={h.id} className="border rounded p-3 text-sm space-y-1">
          <div className="font-medium">
            {h.type} — {h.status}
          </div>

          {h.date && <div className="text-gray-500">{new Date(h.date).toLocaleString()}</div>}

          {h.empresa && <div>Empresa: {h.empresa}</div>}

          {h.quantity != null && (
            <div>
              {h.quantity} {h.unit ?? ''}
            </div>
          )}

          {h.processName && <div>Processo: {h.processName}</div>}

          {h.nfEntrada && <div>NF Entrada: {h.nfEntrada}</div>}

          {h.nfSaida && <div>NF Saída: {h.nfSaida}</div>}

          {h.reference && <div className="text-gray-500">{h.reference}</div>}

          {h.snapshot && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-600">Ver detalhes</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap">
                {JSON.stringify(h.snapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}
