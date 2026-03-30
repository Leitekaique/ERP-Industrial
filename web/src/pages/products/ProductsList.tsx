import { useEffect, useState, useMemo } from 'react'
import { useApi } from '../../lib/useApi'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

export default function ProductsList() {
  const api = useApi()
  const nav = useNavigate()

  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [processoFiltro, setProcessoFiltro] = useState('')
  const [tenantId] = useState('T-001')
  const [companyId] = useState('C-001')

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  async function fetchProducts() {
    try {
      const res = await api.get('/products', {
        params: { tenantId, companyId, q: search || undefined },
      })
      setProducts(Array.isArray(res.data) ? res.data : res)
    } catch (err) {
      console.error('❌ Erro ao buscar produtos:', err)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const empresasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { const n = p.empresaOrigem?.nome || p.empresaNome; if (n) set.add(n) })
    return Array.from(set).sort()
  }, [products])

  const processosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { if (p.processo) set.add(p.processo) })
    return Array.from(set).sort()
  }, [products])

  const sortedProducts = useMemo(() => {
    let sorted = products.filter(p => {
      if (empresaFiltro) {
        const nome = p.empresaOrigem?.nome || p.empresaNome || ''
        if (nome !== empresaFiltro) return false
      }
      if (processoFiltro && p.processo !== processoFiltro) return false
      return true
    })
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue: any
        let bValue: any
        if (sortConfig.key === 'price') {
          aValue = Number(a.price ?? 0)
          bValue = Number(b.price ?? 0)
        } else {
          aValue = a[sortConfig.key] ?? ''
          bValue = b[sortConfig.key] ?? ''
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
        }
        return sortConfig.direction === 'asc'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue))
      })
    }
    return sorted
  }, [products, sortConfig])

  const totalPages = Math.ceil(sortedProducts.length / pageSize)
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedProducts.slice(start, start + pageSize)
  }, [sortedProducts, currentPage])

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      return { key, direction: 'asc' }
    })
  }

  const sortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Produtos" sub="Cadastro de produtos e serviços">
        <button
          onClick={() => nav('/products/new')}
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Novo produto
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
          placeholder="Buscar por nome / SKU"
          className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
        />
        <select
          className="border rounded px-2 py-2 text-sm"
          value={empresaFiltro}
          onChange={e => setEmpresaFiltro(e.target.value)}
        >
          <option value="">Todas as empresas</option>
          {empresasDisponiveis.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          className="border rounded px-2 py-2 text-sm"
          value={processoFiltro}
          onChange={e => setProcessoFiltro(e.target.value)}
        >
          <option value="">Todos os processos</option>
          {processosDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          onClick={fetchProducts}
          className="px-3 py-2 bg-tapajos-700 text-white rounded text-sm hover:bg-tapajos-800"
        >
          Buscar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 select-none">
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort('sku')}
              >
                SKU{sortIcon('sku')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort('name')}
              >
                Nome{sortIcon('name')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort('empresaNome')}
              >
                Empresa Origem{sortIcon('empresaNome')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort('processo')}
              >
                Processo{sortIcon('processo')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Un.
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer"
                onClick={() => handleSort('price')}
              >
                Preço{sortIcon('price')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedProducts.length === 0 ? (
              <EmptyState message="Nenhum produto encontrado" colSpan={7} />
            ) : (
              paginatedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.empresaOrigem?.nome || p.empresaNome || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.processo || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">
                    {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => nav(`/products/${p.id}`)}
                        className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir o produto "${p.name}"?`)) return
                          await api.delete(`/products/${p.id}`)
                          fetchProducts()
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
        <div className="flex justify-center items-center gap-3">
          <button
            className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-sm hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            ← Anterior
          </button>
          <span className="text-sm text-slate-500">Página {currentPage} de {totalPages}</span>
          <button
            className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-sm hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
