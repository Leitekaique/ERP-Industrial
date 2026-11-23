import { useParams, useNavigate } from 'react-router-dom'
import { useLotMovements } from '../../lib/useApi'

const typeLabel: Record<string, string> = {
  in:  'Entrada',
  out: 'Saída',
  transfer_in:  'Transferência entrada',
  transfer_out: 'Transferência saída',
  convert_in:   'Conversão entrada',
  convert_out:  'Conversão saída',
}

const typeColor: Record<string, string> = {
  in:  'text-green-700 bg-green-50',
  out: 'text-red-700 bg-red-50',
  transfer_in:  'text-blue-700 bg-blue-50',
  transfer_out: 'text-blue-700 bg-blue-50',
  convert_in:   'text-purple-700 bg-purple-50',
  convert_out:  'text-purple-700 bg-purple-50',
}

export default function StockLotMovementsPage() {
  const { lotId } = useParams<{ lotId: string }>()
  const nav = useNavigate()
  const { data, isLoading, error } = useLotMovements(lotId)

  if (isLoading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-600">Erro ao carregar movimentos do lote.</div>
        <button className="mt-3 px-3 py-1 border rounded text-sm" onClick={() => nav(-1)}>Voltar</button>
      </div>
    )
  }

  const { lot, movements } = data

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Movimentos do Lote</h2>
        <button className="px-3 py-1 border rounded text-sm" onClick={() => nav(-1)}>Voltar</button>
      </div>

      {lot && (
        <div className="rounded-lg border bg-white p-4 space-y-1 text-sm">
          <div className="font-semibold text-slate-800">{lot.productName} <span className="text-slate-400 font-normal text-xs">({lot.sku})</span></div>
          <div className="text-slate-500">Processo: {lot.processo} · Depósito: {lot.warehouseName}</div>
          <div className="text-slate-500">
            Qtd inicial: <span className="font-medium text-slate-700">{lot.qtyInitial} {lot.unit}</span>
            {' · '}
            Saldo atual: <span className="font-medium text-slate-700">{lot.qtyRemaining} {lot.unit}</span>
          </div>
          {lot.reference && <div className="text-slate-400 text-xs">Ref.: {lot.reference}</div>}
          {lot.nfEntrada && <div className="text-slate-400 text-xs">NF de entrada: {lot.nfEntrada}</div>}
          <div className="text-slate-400 text-xs">Entrada em: {new Date(lot.occurredAt).toLocaleDateString('pt-BR')}</div>
        </div>
      )}

      {movements.length === 0 && (
        <div className="text-sm text-slate-500">Nenhum movimento registrado para este lote.</div>
      )}

      <div className="space-y-2">
        {movements.map((m: any) => (
          <div key={m.id} className="rounded border bg-white p-3 text-sm space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeColor[m.type] ?? 'text-slate-700 bg-slate-100'}`}>
                {typeLabel[m.type] ?? m.type}
              </span>
              <span className="font-semibold text-slate-800">
                {m.type?.startsWith('out') || m.type === 'transfer_out' || m.type === 'convert_out' ? '-' : '+'}
                {m.qty} {m.unit ?? lot?.unit}
              </span>
              <span className="ml-auto text-slate-400 text-xs">
                {new Date(m.occurredAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {m.reference && <div className="text-slate-500 text-xs">Ref.: {m.reference}</div>}
            {m.note && <div className="text-slate-400 text-xs truncate">{m.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
