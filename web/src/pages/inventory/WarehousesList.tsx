import { useState } from 'react'
import { useCreateWarehouse, useWarehouses } from '../../lib/useApi'
import { FormField } from '../../components/FormField'
import { EmptyState } from '../../components/ui/EmptyState'

export default function WarehousesList() {
  const { data, isLoading, error } = useWarehouses()
  const create = useCreateWarehouse()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({ name, code })
    setName(''); setCode('')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Depósitos</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">Carregando...</td></tr>}
              {error && <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-red-500">Erro ao carregar.</td></tr>}
              {(data ?? []).map(w => (
                <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{w.code}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{w.name}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && !error && (
                <EmptyState message="Nenhum depósito cadastrado" colSpan={2} />
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Novo depósito</h2>
          </div>
          <form className="p-6 space-y-3" onSubmit={submit}>
            <FormField label="Código">
              <input className="border rounded px-3 py-2 w-full" value={code} onChange={e => setCode(e.target.value)} required />
            </FormField>
            <FormField label="Nome">
              <input className="border rounded px-3 py-2 w-full" value={name} onChange={e => setName(e.target.value)} required />
            </FormField>
            <button
              className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700 disabled:opacity-60"
              disabled={create.isPending}
            >
              Criar depósito
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
