import { useEffect, useMemo, useState } from 'react'
import { useProcesses, useDeleteProcess } from '../../lib/useProcesses'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

type SortKey = 'name' | 'artigo' | 'forro' | 'cola' | 'empresaNome' | 'price' | 'unit' | 'active'

export default function ProcessesList() {
  const nav = useNavigate()

  const tenantId = 'T-001'
  const companyId = 'C-001'

  const [search, setSearch] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [ativoFiltro, setAtivoFiltro] = useState<'all' | 'true' | 'false'>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const { data = [], isLoading, refetch } = useProcesses({
    tenantId,
    companyId,
    search: search || undefined,
    active: ativoFiltro === 'all' ? undefined : ativoFiltro === 'true',
  })

  useEffect(() => { refetch() }, [])

  const empresasDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    data.forEach((p: any) => {
      if (p.empresaOrigem?.id) map.set(p.empresaOrigem.id, p.empresaOrigem.nome)
    })
    return Array.from(map.entries())
  }, [data])

  const dadosFiltrados = useMemo(() => {
    let filtered = data.filter((p: any) => {
      if (empresaFiltro && p.empresaOrigem?.id !== empresaFiltro) return false
      return true
    })
    if (sortKey) {
      filtered = [...filtered].sort((a: any, b: any) => {
        let aVal = sortKey === 'price' ? Number(a.price ?? 0) : String(a[sortKey] ?? '')
        let bVal = sortKey === 'price' ? Number(b.price ?? 0) : String(b[sortKey] ?? '')
        if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
      })
    }
    return filtered
  }, [data, empresaFiltro, sortKey, sortDir])

  const deleteProcess = useDeleteProcess()

  return (
    <div className="space-y-4">
      <PageHeader title="Processos" sub="Serviços e processos de beneficiamento">
        <button
          onClick={() => nav('/processes/new')}
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Novo processo
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-2">
        <input
          className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
          placeholder="Buscar em todas as colunas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={empresaFiltro}
          onChange={(e) => setEmpresaFiltro(e.target.value)}
        >
          <option value="">Todas as empresas</option>
          {empresasDisponiveis.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2 text-sm"
          value={ativoFiltro}
          onChange={(e) => setAtivoFiltro(e.target.value as any)}
        >
          <option value="all">Ativos e inativos</option>
          <option value="true">Somente ativos</option>
          <option value="false">Somente inativos</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 select-none">
              {([['name','Processo'],['artigo','Artigo'],['forro','Forro'],['cola','Cola'],['empresaNome','Empresa']] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort(key)}>
                  {label}{sortIcon(key)}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('price')}>
                Preço{sortIcon('price')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('unit')}>
                Unidade{sortIcon('unit')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer" onClick={() => handleSort('active')}>
                Ativo{sortIcon('active')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dadosFiltrados.length === 0 && !isLoading ? (
              <EmptyState message="Nenhum processo encontrado" colSpan={9} />
            ) : (
              dadosFiltrados.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-900 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.artigo || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.forro || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.cola || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.empresaNome || '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">
                    {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{p.unit ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                        : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20'
                    }`}>
                      {p.active ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => nav(`/processes/${p.id}`)}
                        className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir o processo "${p.name}"?`)) return
                          await deleteProcess.mutateAsync(p.id)
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
    </div>
  )
}
