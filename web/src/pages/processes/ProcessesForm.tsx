import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FormField } from '../../components/FormField'
import { useCreateProcess, useUpdateProcess, useProcess } from '../../lib/useProcesses'
import { useEmpresasOrigem } from '../../lib/useEmpresasOrigem'
import { PageHeader } from '../../components/ui/PageHeader'

export default function ProcessForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const editing = !!id
  const create = useCreateProcess()
  const update = useUpdateProcess()
  const { data: process, isLoading, isFetching, status } = useProcess(id)

  // 🔹 Empresas (origem)
  const { data: empresas = [] } = useEmpresasOrigem({
    tenantId: 'T-001',
    companyId: 'C-001',
  })

  // 🔹 Campos
  const [empresaId, setEmpresaId] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('M')
  const [price, setPrice] = useState<number>()
  const [artigo, setArtigo] = useState('')
  const [forro, setForro] = useState('')
  const [cola, setCola] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  
  useEffect(() => {
  if (!editing) return
  if (!process) return
  setEmpresaId(process.empresaOrigem?.id || '')
  setName(process.name || '')
  setUnit(process.unit || 'M')
  setPrice(Number(process.price || 0))
  setArtigo(process.artigo || '')
  setForro(process.forro || '')
  setCola(process.cola || '')
  setDescription(process.description || '')
  setActive(process.active ?? true)
}, [editing, process?.id])
if (editing && !process) {
  return <p className="text-sm text-slate-500 p-4">Carregando processo...</p>
}
  async function submit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      empresaId,
      name,
      unit,
      price,
      artigo: artigo || null,
      forro: forro || null,
      cola: cola || null,
      description: description || null,
      active,
    }
	try {
		if (editing) {
			await update.mutateAsync({id, data: payload,})
		} else {
			await create.mutateAsync(payload)
		}
		nav('/processes')
	} catch (err: any) {
		console.error('❌ ERRO PROCESS CREATE:', err?.response?.data || err)
	}
  }
  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader
        title={editing ? 'Editar processo' : 'Novo processo'}
        sub="Configurações do processo de beneficiamento"
      />
    <form className="bg-white rounded-xl border border-slate-200 overflow-hidden" onSubmit={submit}>
      <div className="p-6 space-y-3">

      <FormField label="Empresa">
        <select
          className="border rounded px-3 py-2 w-full"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.tipo})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Nome do processo">
        <input
          className="border rounded px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Unidade">
        <input
          className="border rounded px-3 py-2 w-full"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Preço do serviço">
        <input
          className="border rounded px-3 py-2 w-full"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          required
        />
      </FormField>

      <div className="grid grid-cols-3 gap-3">
        <FormField label="Artigo">
          <input className="border rounded px-3 py-2 w-full" value={artigo} onChange={e => setArtigo(e.target.value)} />
        </FormField>
        <FormField label="Forro">
          <input className="border rounded px-3 py-2 w-full" value={forro} onChange={e => setForro(e.target.value)} />
        </FormField>
        <FormField label="Cola">
          <input className="border rounded px-3 py-2 w-full" value={cola} onChange={e => setCola(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Descrição">
        <textarea
          className="border rounded px-3 py-2 w-full"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </FormField>

      <FormField label="Ativo">
        <input type="checkbox" checked={active} onChange={() => setActive(!active)} />
      </FormField>

      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
        <button className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700" type="submit">
          {editing ? 'Salvar alterações' : 'Criar processo'}
        </button>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50" type="button" onClick={() => nav('/processes')}>
          Cancelar
        </button>
      </div>
    </form>
    </div>
  )
}
