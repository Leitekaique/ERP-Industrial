import { useEffect, useState } from 'react'
import { useCreateSupplier, useSupplier, useUpdateSupplier } from '../../lib/useApi'
import { useNavigate, useParams } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/ui/PageHeader'

export default function SupplierForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const editing = !!id
  const { data: supplier, isLoading } = useSupplier(id)
  const create = useCreateSupplier()
  const update = useUpdateSupplier()

  const [form, setForm] = useState({
    docType: 'CNPJ',
    document: '',
    name: '',
    ie: '',
    email: '',
    phone: '',
    zip: '',
    address: '',
    number: '',
    district: '',
    city: '',
    state: '',
    cityCode: '',
    emailFinanceiro: '',
    emailAdicional1: '',
    emailAdicional2: '',
  })

  useEffect(() => {
    if (!editing || !supplier) return
      setForm({
        docType: supplier.docType ?? 'CNPJ',
        document: supplier.document ?? '',
        name: supplier.name ?? '',
        ie: supplier.ie ?? '',
        email: supplier.email ?? '',
        phone: supplier.phone ?? '',
        zip: supplier.zip ?? '',
        address: supplier.address ?? '',
        number: supplier.number ?? '',
        district: supplier.district ?? '',
        city: supplier.city ?? '',
        state: supplier.state ?? '',
        cityCode: supplier.cityCode ?? '',
        emailFinanceiro: supplier.emailFinanceiro ?? '',
        emailAdicional1: supplier.emailAdicional1 ?? '',
        emailAdicional2: supplier.emailAdicional2 ?? '',
      })
  }, [editing, supplier?.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (editing){
		await update.mutateAsync({id, data: form,})
    } else {
		await create.mutateAsync(form)
	}
    nav('/suppliers')
  }
if (editing && !supplier) {
  return <p className="text-sm text-slate-500 p-4">Carregando fornecedor...</p>
}
  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        sub="Dados cadastrais do fornecedor"
      />
    <form className="bg-white rounded-xl border border-slate-200 overflow-hidden" onSubmit={submit}>
      <div className="p-6 space-y-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 border-b border-slate-100">Identificação</div>
      {/* Documento */}
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Tipo doc.">
          <select
            className="border rounded px-3 py-2 w-full"
            value={form.docType}
            onChange={(e) => setForm({ ...form, docType: e.target.value })}
          >
            <option value="CNPJ">CNPJ</option>
            <option value="CPF">CPF</option>
          </select>
        </FormField>

        <FormField label="Documento" required>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.document}
            onChange={(e) => setForm({ ...form, document: e.target.value })}
            required
          />
        </FormField>

        <FormField label="Inscrição Estadual (IE)">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.ie}
            onChange={(e) => setForm({ ...form, ie: e.target.value })}
          />
        </FormField>
      </div>

      {/* Identificação */}
      <FormField label="Razão social / Nome" required>
        <input
          className="border rounded px-3 py-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </FormField>

      {/* Contato principal */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="E-mail principal" required>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="Telefone">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
      </div>
      {/* Endereço */}
      <div className="grid grid-cols-3 gap-3">
        <FormField label="CEP">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.zip}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
          />
        </FormField>
        <FormField label="Endereço">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        <FormField label="Número">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Bairro / Distrito">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
        </FormField>
        <FormField label="Município">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </FormField>
        <FormField label="UF">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.state}
            maxLength={2}
            onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
          />
        </FormField>
        <FormField label="Cód. IBGE do Município">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.cityCode}
            placeholder="Ex: 3550308"
            onChange={(e) => setForm({ ...form, cityCode: e.target.value })}
          />
        </FormField>
      </div>

      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2 pb-2 border-b border-slate-100">Contatos adicionais</div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="E-mail financeiro">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.emailFinanceiro}
            onChange={(e) => setForm({ ...form, emailFinanceiro: e.target.value })}
          />
        </FormField>
        <FormField label="E-mail adicional 1">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.emailAdicional1}
            onChange={(e) => setForm({ ...form, emailAdicional1: e.target.value })}
          />
        </FormField>
        <FormField label="E-mail adicional 2">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.emailAdicional2}
            onChange={(e) => setForm({ ...form, emailAdicional2: e.target.value })}
          />
        </FormField>
      </div>

      {editing && supplier && (
        <div className="flex gap-6 text-xs text-slate-400 pt-1">
          <span>Criado em: {new Date(supplier.createdAt).toLocaleString('pt-BR')}</span>
          <span>Atualizado em: {new Date(supplier.updatedAt).toLocaleString('pt-BR')}</span>
        </div>
      )}
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
        <button
          className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
          type="submit"
          disabled={create.isPending || update.isPending}
        >
          {editing ? 'Salvar alterações' : 'Criar fornecedor'}
        </button>
        <button
          className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
          type="button"
          onClick={() => nav('/suppliers')}
        >
          Cancelar
        </button>
      </div>
    </form>
    </div>
  )
}
