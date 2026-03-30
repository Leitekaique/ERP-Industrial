import { useEffect, useState } from 'react'
import { useApi, useDeleteTransporter } from '../../lib/useApi'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

function formatDoc(doc?: string) {
  const v = (doc ?? '').replace(/\D/g, '')
  if (v.length === 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (v.length === 14) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc ?? '-'
}

export default function TransporterList() {
  const api = useApi()
  const deleteTransporter = useDeleteTransporter()
  const [list, setList] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const tenantId = import.meta.env.VITE_TENANT_ID
  const companyId = import.meta.env.VITE_COMPANY_ID

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const res: any = await api.get('/transporter', {
        params: { tenantId, companyId, q: q || undefined },
      })
      const data = Array.isArray(res) ? res : res?.data ?? res
      setList(Array.isArray(data) ? data : [])
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao carregar transportadoras.'
      setError(String(msg))
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q])

  return (
    <div className="space-y-4">
      <PageHeader title="Transportadoras" sub="Cadastro de transportadoras">
        <Link
          to="/transporter/new"
          className="px-3 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
        >
          Nova transportadora
        </Link>
      </PageHeader>

      <div className="flex items-end gap-2">
        <input
          type="text"
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">CPF/CNPJ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cidade/UF</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>Carregando…</td></tr>
            )}
            {!loading && !list.length && (
              <EmptyState message="Nenhuma transportadora cadastrada" colSpan={6} />
            )}
            {!loading && list.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-900 font-medium">
                  <div>{t.name}</div>
                  {t.address && (
                    <div className="text-xs text-slate-400">
                      {t.address}{t.number ? `, ${t.number}` : ''}{t.district ? ` - ${t.district}` : ''}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDoc(t.cnpj)}</td>
                <td className="px-4 py-3 text-slate-500">{t.phone || '-'}</td>
                <td className="px-4 py-3 text-slate-500">{t.email || '-'}</td>
                <td className="px-4 py-3 text-slate-500">{t.city || '-'}{t.uf ? `/${t.uf}` : ''}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/transporter/${t.id}`}
                      className="text-xs text-tapajos-600 hover:text-tapajos-800 font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                      onClick={async () => {
                        if (!confirm(`Excluir a transportadora "${t.name}"?`)) return
                        await deleteTransporter.mutateAsync(t.id)
                        load()
                      }}
                      disabled={deleteTransporter.isPending}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
