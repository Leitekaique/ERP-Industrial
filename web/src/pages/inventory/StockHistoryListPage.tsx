import React, { useMemo, useState } from 'react'
import { useStockHistoryList } from '../../lib/useApi'

function fmtDate(d?: string | Date | null) {
  if (!d) return '-'
  const dt = typeof d === 'string' ? new Date(d) : d
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleString('pt-BR')
}

type SortKey = 'date' | 'empresa' | 'produto' | 'processo' | 'tipo' | 'status' | 'quantity'
type SortDir = 'asc' | 'desc'

function getVal(h: any, key: SortKey): any {
  if (key === 'date') return h.date ? new Date(h.date).getTime() : 0
  if (key === 'empresa') return h.empresa ?? ''
  if (key === 'produto') return h.productName ?? h.productSku ?? ''
  if (key === 'processo') return h.processName ?? ''
  if (key === 'tipo') return h.type ?? ''
  if (key === 'status') return h.status ?? ''
  if (key === 'quantity') return Number(h.quantity ?? 0)
  return ''
}

export default function StockHistoryListPage() {
  const { data = [], isLoading } = useStockHistoryList()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-0.5 text-gray-300">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? data.filter((h: any) =>
          [h.empresa, h.productName, h.productSku, h.processName, h.type, h.status,
           h.nfEntrada, h.nfSaida, h.reference, fmtDate(h.date)]
            .some(v => String(v ?? '').toLowerCase().includes(q))
        )
      : data

    return [...filtered].sort((a: any, b: any) => {
      const av = getVal(a, sortKey)
      const bv = getVal(b, sortKey)
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, search, sortKey, sortDir])

  const thCls = "p-2 text-left cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"

  if (isLoading) return <div className="p-4">Carregando histórico...</div>

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">Histórico de produção</h2>
          <p className="text-xs text-gray-500">
            Clique nos cabeçalhos para ordenar. Campos podem ser nulos dependendo do tipo do evento.
          </p>
        </div>
        <input
          type="text"
          className="border rounded px-3 py-2 text-sm w-64"
          placeholder="Buscar em todas colunas…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 border-b">
            <tr>
              <th className={thCls} onClick={() => toggleSort('date')}>Data<SortIcon col="date" /></th>
              <th className={thCls} onClick={() => toggleSort('empresa')}>Empresa<SortIcon col="empresa" /></th>
              <th className={thCls} onClick={() => toggleSort('produto')}>Produto<SortIcon col="produto" /></th>
              <th className={thCls} onClick={() => toggleSort('processo')}>Processo<SortIcon col="processo" /></th>
              <th className={thCls} onClick={() => toggleSort('tipo')}>Tipo<SortIcon col="tipo" /></th>
              <th className={thCls} onClick={() => toggleSort('status')}>Status<SortIcon col="status" /></th>
              <th className="p-2 text-right cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleSort('quantity')}>Qtd<SortIcon col="quantity" /></th>
              <th className="p-2 text-left">Un.</th>
              <th className="p-2 text-left">NF Entrada</th>
              <th className="p-2 text-left">NF Saída</th>
              <th className="p-2 text-left">Referência</th>
            </tr>
          </thead>

          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={11} className="p-3 text-center text-gray-500">
                  {search ? 'Nenhum resultado para a busca.' : 'Nenhum evento encontrado.'}
                </td>
              </tr>
            )}

            {rows.map((h: any) => (
              <tr key={h.id} className="border-t hover:bg-gray-50">
                <td className="p-2 whitespace-nowrap">{fmtDate(h.date)}</td>
                <td className="p-2">{h.empresa ?? '-'}</td>
                <td className="p-2">
                  <div className="font-medium">{h.productSku ?? h.productId ?? '-'}</div>
                  <div className="text-xs text-gray-500">{h.productName ?? ''}</div>
                </td>
                <td className="p-2">{h.processName ?? '-'}</td>
                <td className="p-2">{h.type}</td>
                <td className="p-2">{h.status}</td>
                <td className="p-2 text-right">{h.quantity ?? '-'}</td>
                <td className="p-2">{h.unit ?? '-'}</td>
                <td className="p-2">{h.nfEntrada ?? h.snapshot?.nfEntrada ?? '-'}</td>
                <td className="p-2">{h.nfSaida ?? '-'}</td>
                <td className="p-2">{h.reference ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
