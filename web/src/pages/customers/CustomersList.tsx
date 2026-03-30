import { useEffect, useState } from 'react'
import { useApi } from '../../lib/useApi'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

export default function CustomersList() {
  const api = useApi()
  const nav = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [tenantId] = useState('T-001')
  const [companyId] = useState('C-001')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [sortKey, setSortKey] = useState<'name' | 'document' | 'city' | 'state' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  async function fetchCustomers() {
    try {
      const res = await api.get('/customers', {
        params: { tenantId, companyId, q: search || undefined },
      })
      const data = Array.isArray(res.data) ? res.data : res
      setCustomers(data)
    } catch (err) {
      console.error('❌ Erro ao buscar clientes:', err)
    }
  }

  useEffect(() => { fetchCustomers() }, [])

  function sortBy(key: typeof sortKey) {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  function isIncomplete(c: any) {
    return !c.email || !c.document || !c.city || !c.state
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    const aVal = a[sortKey] ?? ''
    const bVal = b[sortKey] ?? ''
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const startIndex = (page - 1) * pageSize
  const paginated = sortedCustomers.slice(startIndex, startIndex + pageSize)
  const totalPages = Math.ceil(sortedCustomers.length / pageSize)

  const sortIcon = (key: typeof sortKey) =>
    sortKey === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" sub="Cadastro de clientes e destinatários">
        <button
          onClick={() => nav('/customers/new')}
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Novo cliente
        </button>
      </PageHeader>

      <div className="flex items-end gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
          placeholder="Buscar por nome ou CNPJ"
          className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
        />
        <button
          onClick={fetchCustomers}
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
              <EmptyState message="Nenhum cliente encontrado" colSpan={6} />
            ) : (
              paginated.map((c) => (
                <tr key={c.id} className={`transition-colors ${isIncomplete(c) ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {c.name}
                    {isIncomplete(c) && <span className="ml-2 text-xs text-amber-600 font-normal">dados incompletos</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.document || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{c.city || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{c.state || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.email || <span className="text-amber-500">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => nav(`/customers/${c.id}`)}
                        className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir o cliente "${c.name}"?`)) return
                          await api.delete(`/customers/${c.id}`)
                          fetchCustomers()
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
