import { useEffect, useState } from 'react'
import { useApi } from '../../lib/useApi'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

export default function SuppliersList() {
  const api = useApi()
  const nav = useNavigate()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [tenantId] = useState('T-001')
  const [companyId] = useState('C-001')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [sortKey, setSortKey] = useState<'name' | 'document' | 'city' | 'state' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  async function fetchSuppliers() {
    try {
      const res = await api.get('/suppliers', {
        params: { tenantId, companyId, q: search || undefined },
      })
      const data = Array.isArray(res.data) ? res.data : res
      setSuppliers(data)
    } catch (err) {
      console.error('❌ Erro ao buscar fornecedores:', err)
    }
  }

  useEffect(() => { fetchSuppliers() }, [])

  function sortBy(key: typeof sortKey) {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  function isIncomplete(s: any) {
    return !s.email || !s.document || !s.city || !s.state
  }

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const aVal = a[sortKey] ?? ''
    const bVal = b[sortKey] ?? ''
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const startIndex = (page - 1) * pageSize
  const paginated = sortedSuppliers.slice(startIndex, startIndex + pageSize)
  const totalPages = Math.ceil(sortedSuppliers.length / pageSize)

  const sortIcon = (key: typeof sortKey) =>
    sortKey === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="space-y-4">
      <PageHeader title="Fornecedores" sub="Cadastro de fornecedores">
        <button
          onClick={() => nav('/suppliers/new')}
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Novo fornecedor
        </button>
      </PageHeader>

      <div className="flex items-end gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchSuppliers()}
          placeholder="Buscar por nome ou CNPJ"
          className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
        />
        <button
          onClick={fetchSuppliers}
          className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm hover:bg-tapajos-800"
        >
          Buscar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => sortBy('name')}
              >
                Nome{sortIcon('name')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => sortBy('document')}
              >
                CNPJ/CPF{sortIcon('document')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => sortBy('city')}
              >
                Cidade{sortIcon('city')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => sortBy('state')}
              >
                UF{sortIcon('state')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <EmptyState message="Nenhum fornecedor encontrado" colSpan={6} />
            ) : (
              paginated.map((s) => (
                <tr key={s.id} className={`transition-colors ${isIncomplete(s) ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {s.name}
                    {isIncomplete(s) && <span className="ml-2 text-xs text-amber-600 font-normal">dados incompletos</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.document || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{s.city || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{s.state || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.email || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => nav(`/suppliers/${s.id}`)}
                        className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return
                          await api.delete(`/suppliers/${s.id}`)
                          fetchSuppliers()
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${
                page === i + 1
                  ? 'bg-tapajos-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
