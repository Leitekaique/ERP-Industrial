import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useDeleteNfe } from '../../lib/useApi'
import { StatusBadge, NFE_STATUS } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import CancelNfeModal from './CancelNfeModal'
import CceModal from './CceModal'

type SortKey = 'number' | 'recipient' | 'totalInvoice' | 'billingAmount' | 'issuedAt' | 'status'
const PAGE_SIZE = 50

async function downloadFile(nfeId: string, type: 'xml' | 'danfe', filename: string, tenantId: string, companyId: string) {
  try {
    const res = await api.get(`/nfe-emit/${nfeId}/${type}`, {
      responseType: 'blob',
      params: { tenantId, companyId },
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      alert('XML não encontrado no servidor. O arquivo pode ter sido removido.')
    } else {
      alert(`Erro ao baixar ${type.toUpperCase()}: ${status ?? 'sem conexão'}`)
    }
  }
}

function toPtMoney(v: any) {
  const n = Number(v ?? 0)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function toPtDate(d: any) {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('pt-BR')
}

function sumQty(items: any) {
  if (!Array.isArray(items)) return 0
  return items.reduce((acc: number, it: any) => acc + Number(it?.qty ?? 0), 0)
}

export default function NfeList() {
  const navigate = useNavigate()
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const deleteNfe = useDeleteNfe()
  const [cancelModal, setCancelModal] = useState<{ id: string; number: any } | null>(null)
  const [cceModal, setCceModal] = useState<{ id: string; number: any } | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Ordenação e paginação
  const [sortKey, setSortKey] = useState<SortKey>('number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc'); setPage(0) }
  }

  function sortIcon(key: SortKey) {
    return sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  }

  const tenantId = String(import.meta.env.VITE_TENANT_ID ?? 'T-001')
  const companyId = String(import.meta.env.VITE_COMPANY_ID ?? 'C-001')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nfe-list', tenantId, companyId],
    queryFn: async () =>
      (await api.get('/nfe-emit', { params: { tenantId, companyId } })).data,
  })

  async function handleImportXml(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImporting(true)
    setImportMsg(null)
    let ok = 0
    const erros: string[] = []
    for (const file of files) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('tenantId', tenantId)
        fd.append('companyId', companyId)
        await api.post('/nfe-emit/import-xml', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        ok++
      } catch (err: any) {
        const raw = err?.response?.data?.message ?? err?.message ?? 'Erro desconhecido'
        const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
        erros.push(`${file.name}: ${msg}`)
      }
    }
    setImporting(false)
    const resumo = ok > 0 ? `${ok} importada(s) com sucesso.` : ''
    const detalheErros = erros.length > 0 ? erros.join('\n') : ''
    setImportMsg({
      text: [resumo, detalheErros].filter(Boolean).join('\n'),
      ok: erros.length === 0,
    })
    e.target.value = ''
    refetch()
  }

  const filtered = useMemo(() => {
    let arr = Array.isArray(data) ? [...data] : []
    const q = search.toLowerCase()
    if (q) {
      arr = arr.filter((n: any) => {
        const recipient = String(n?.customer?.name ?? n?.supplier?.name ?? n?.receiver ?? '')
        const num = String(n?.number ?? '')
        return recipient.toLowerCase().includes(q) || num.includes(q)
      })
    }
    if (filterStatus) arr = arr.filter((n: any) => String(n?.status ?? '') === filterStatus)
    if (filterFrom) arr = arr.filter((n: any) => {
      const d = n?.issuedAt ?? n?.createdAt
      return d && new Date(d) >= new Date(filterFrom)
    })
    if (filterTo) arr = arr.filter((n: any) => {
      const d = n?.issuedAt ?? n?.createdAt
      return d && new Date(d) <= new Date(filterTo + 'T23:59:59')
    })
    return arr
  }, [data, search, filterStatus, filterFrom, filterTo])

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let aVal: any, bVal: any
      if (sortKey === 'number') {
        aVal = Number(a?.number ?? 0); bVal = Number(b?.number ?? 0)
      } else if (sortKey === 'recipient') {
        aVal = String(a?.customer?.name ?? a?.supplier?.name ?? '')
        bVal = String(b?.customer?.name ?? b?.supplier?.name ?? '')
      } else if (sortKey === 'totalInvoice') {
        aVal = Number(a?.totalInvoice ?? 0); bVal = Number(b?.totalInvoice ?? 0)
      } else if (sortKey === 'billingAmount') {
        aVal = Number(a?.billingAmount ?? 0); bVal = Number(b?.billingAmount ?? 0)
      } else if (sortKey === 'issuedAt') {
        aVal = new Date(a?.issuedAt ?? a?.createdAt ?? 0).getTime()
        bVal = new Date(b?.issuedAt ?? b?.createdAt ?? 0).getTime()
      } else if (sortKey === 'status') {
        aVal = String(a?.status ?? ''); bVal = String(b?.status ?? '')
      } else {
        aVal = 0; bVal = 0
      }
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <PageHeader title="Emissão NF-e" sub="Notas fiscais emitidas">
        <label className={`px-3 py-2 border rounded text-sm bg-white cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
          {importing ? 'Importando…' : 'Importar XML histórico'}
          <input
            type="file"
            accept=".xml"
            multiple
            className="hidden"
            onChange={handleImportXml}
            disabled={importing}
          />
        </label>
        <button
          onClick={() => navigate('/nfe-emit/form')}
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Nova NF-e
        </button>
      </PageHeader>
      {importMsg && (
        <div className={`px-4 py-2 rounded text-sm whitespace-pre-line ${importMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {importMsg.text}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="block text-xs text-slate-500 mb-1">Buscar</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Destinatário ou Nº NF..."
            className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
          />
        </div>
        <div>
          <span className="block text-xs text-slate-500 mb-1">Status</span>
          <select className="border rounded px-2 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">(Todos)</option>
            <option value="draft">Rascunho</option>
            <option value="authorized">Autorizada</option>
            <option value="canceled">Cancelada</option>
          </select>
        </div>
        <div>
          <span className="block text-xs text-slate-500 mb-1">De</span>
          <input type="date" className="border rounded px-2 py-2 text-sm" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <span className="block text-xs text-slate-500 mb-1">Até</span>
          <input type="date" className="border rounded px-2 py-2 text-sm" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(search || filterStatus || filterFrom || filterTo) && (
          <button
            className="px-3 py-2 text-sm text-slate-500 border rounded hover:bg-slate-50"
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}
          >
            Limpar
          </button>
        )}
        <span className="text-xs text-slate-400 self-end pb-2">{sorted.length} resultado(s)</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 self-end pb-2">
            <button className="px-2 py-1 text-xs border rounded disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
            <span className="text-xs text-slate-500">{page + 1} / {pageCount}</span>
            <button className="px-2 py-1 text-xs border rounded disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 select-none">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('number')}>
                Nº NF{sortIcon('number')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('recipient')}>
                Destinatário{sortIcon('recipient')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('totalInvoice')}>
                Total NF{sortIcon('totalInvoice')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('billingAmount')}>
                Cobrança{sortIcon('billingAmount')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('issuedAt')}>
                Emissão{sortIcon('issuedAt')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Peso liq.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('status')}>
                Status{sortIcon('status')}
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Carregando…</td></tr>
            )}
            {!isLoading && (!sorted || sorted.length === 0) && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma NF encontrada</td></tr>
            )}

            {paged.map((nfe: any) => {
              const number = nfe?.number ?? nfe?.nfe_number ?? '-'
              const recipient = nfe?.customer?.name || nfe?.supplier?.name || nfe?.receiver || nfe?.destinatario || nfe?.receiver_name || '-'
              const status = String(nfe?.status ?? 'draft')
              const isDraft = status === 'draft'
              const valorTotal = nfe?.totalInvoice ?? nfe?.totalProducts ?? nfe?.total_value ?? 0
              const valorCobranca = nfe?.billingAmount ?? null
              const dataCobranca = nfe?.issuedAt ?? nfe?.issue_date ?? nfe?.createdAt
              const qtd = nfe?.volumesQty != null ? nfe.volumesQty : null
              const pesoLiquido = nfe?.weightNet ?? null

              return (
                <tr key={nfe.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{number}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{recipient}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">{toPtMoney(valorTotal)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {valorCobranca != null ? toPtMoney(valorCobranca) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{toPtDate(dataCobranca)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{qtd != null ? Number(qtd).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {pesoLiquido != null ? Number(pesoLiquido).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} map={NFE_STATUS} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isDraft ? (
                        <>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-tapajos-600 text-white hover:bg-tapajos-700 transition-colors"
                            onClick={() => navigate(`/nfe-emit/${nfe.id}`)}
                          >
                            Finalizar
                          </button>
                          <button
                            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="Excluir rascunho"
                            disabled={deleteNfe.isPending}
                            onClick={async () => {
                              if (!confirm('Excluir este rascunho?')) return
                              await deleteNfe.mutateAsync(nfe.id)
                            }}
                          >
                            Excluir
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={nfe.xmlPath ? 'Baixar XML' : 'XML não disponível'}
                            disabled={!nfe.xmlPath}
                            onClick={() => downloadFile(nfe.id, 'xml', `nfe-${number}.xml`, tenantId, companyId)}
                          >
                            XML
                          </button>
                          <button
                            className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            title="Baixar DANFE (PDF)"
                            onClick={() => downloadFile(nfe.id, 'danfe', `danfe-${number}.pdf`, tenantId, companyId)}
                          >
                            PDF
                          </button>
                          {status === 'authorized' && (() => {
                            const issuedAt = nfe.issuedAt ? new Date(nfe.issuedAt) : null
                            const within24h = issuedAt && (Date.now() - issuedAt.getTime()) < 24 * 60 * 60 * 1000
                            return within24h ? (
                              <button
                                className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Cancelar NF-e (prazo 24h)"
                                onClick={() => setCancelModal({ id: nfe.id, number })}
                              >
                                Cancelar
                              </button>
                            ) : null
                          })()}
                          {status === 'authorized' && (
                            <button
                              className="px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                              title="Carta de Correção Eletrônica"
                              onClick={() => setCceModal({ id: nfe.id, number })}
                            >
                              CC-e
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cancelModal && (
        <CancelNfeModal
          nfe={cancelModal}
          onClose={() => setCancelModal(null)}
          onSuccess={() => { setCancelModal(null); refetch() }}
        />
      )}

      {cceModal && (
        <CceModal
          nfe={cceModal}
          onClose={() => setCceModal(null)}
          onSuccess={() => { setCceModal(null); refetch() }}
        />
      )}
    </div>
  )
}
