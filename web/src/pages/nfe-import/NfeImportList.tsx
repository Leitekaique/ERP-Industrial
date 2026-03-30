import React, { useEffect, useMemo, useState } from 'react'
import { useApi } from '../../lib/useApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

type SortKey = 'nfNumber' | 'emitente' | 'destinatario' | 'valorTotal' | 'dataEmissao'
const PAGE_SIZE = 50

export default function NFeImportList() {
  const api = useApi()
  const [tenantId] = useState('T-001')
  const [companyId] = useState('C-001')
  const [nfes, setNfes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dataEmissao')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' })

  const fetchNfes = async () => {
    setLoading(true)
    try {
      const res = await api.get('/nfe-import', { params: { tenantId, companyId } })
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      setNfes(data)
    } catch (error) {
      console.error('❌ Erro ao buscar NFes:', error)
      setNfes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNfes() }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc'); setPage(0) }
  }

  function sortIcon(key: SortKey) {
    return sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return nfes.filter(n => {
      if (!q) return true
      return (
        String(n.nfNumber ?? '').includes(q) ||
        (n.accessKey ?? '').includes(q) ||
        (n.emitente ?? '').toLowerCase().includes(q) ||
        (n.destinatario ?? '').toLowerCase().includes(q)
      )
    })
  }, [nfes, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey]
      let bVal: any = b[sortKey]
      if (sortKey === 'valorTotal') { aVal = Number(aVal ?? 0); bVal = Number(bVal ?? 0) }
      else if (sortKey === 'dataEmissao') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      else { aVal = String(aVal ?? ''); bVal = String(bVal ?? '') }
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setSelectedFile(e.target.files[0])
  }

  const handleUpload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedFile) {
      setToast({ message: 'Selecione um arquivo XML primeiro.', type: 'error' })
      setTimeout(() => setToast({ message: '', type: '' }), 4000)
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('tenantId', tenantId)
      formData.append('companyId', companyId)
      await api.post('/nfe-import/upload', formData, {
        transformRequest: [(data: any) => data],
      })
      setToast({ message: 'Upload realizado com sucesso ✅', type: 'success' })
      setTimeout(() => setToast({ message: '', type: '' }), 4000)
      fetchNfes()
      setSelectedFile(null)
    } catch (error: any) {
      setToast({
        message: 'Erro ao enviar arquivo: ' + (error?.response?.data?.message || error.message),
        type: 'error',
      })
      setTimeout(() => setToast({ message: '', type: '' }), 5000)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 relative">
      {toast.message && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-md text-white shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-tapajos-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-slate-700 font-medium">Enviando arquivo...</span>
          </div>
        </div>
      )}

      <PageHeader title="NF-e Entrada" sub="Importação de notas fiscais recebidas (XML)">
        <form onSubmit={handleUpload} className="flex items-center gap-2">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            className="text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-tapajos-500"
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700 disabled:opacity-60"
          >
            {uploading ? 'Enviando...' : 'Importar XML'}
          </button>
        </form>
      </PageHeader>

      <div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por Nº NF, chave, emitente ou destinatário..."
          className="border rounded px-3 py-2 text-sm w-96 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 select-none">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('nfNumber')}>
                Nº NF{sortIcon('nfNumber')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Chave de Acesso</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('emitente')}>
                Emitente{sortIcon('emitente')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('destinatario')}>
                Destinatário{sortIcon('destinatario')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('valorTotal')}>
                Valor{sortIcon('valorTotal')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('dataEmissao')}>
                Data Emissão{sortIcon('dataEmissao')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Carregando NF-es...</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <EmptyState message="Nenhuma NF-e importada. Envie um XML para começar." colSpan={6} />
            )}
            {!loading && paged.map((nfe) => (
              <tr key={nfe.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {nfe.nfNumber ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{nfe.accessKey}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{nfe.emitente}</td>
                <td className="px-4 py-3 text-slate-500">{nfe.destinatario}</td>
                <td className="px-4 py-3 text-right text-slate-900 font-semibold">
                  {Number(nfe.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 mt-2">
          <button className="px-2 py-1 text-xs border rounded disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span className="text-xs text-slate-500">{page + 1} / {pageCount}</span>
          <button className="px-2 py-1 text-xs border rounded disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
        </div>
      )}
    </div>
  )
}
