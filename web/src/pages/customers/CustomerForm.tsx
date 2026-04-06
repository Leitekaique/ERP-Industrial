import { useEffect, useState } from 'react'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from '../../lib/useApi'
import { useNavigate, useParams } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/ui/PageHeader'

export default function CustomerForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const editing = !!id
  const { data: customer, isLoading } = useCustomer(id)
  const create = useCreateCustomer()
  const update = useUpdateCustomer()

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
    cityCode: '',
    state: '',
    emailFinanceiro: '',
    emailAdicional1: '',
    emailAdicional2: '',
    billingTerms: 'dia15',
  })

  useEffect(() => {
    if (!editing|| !customer) return
      setForm({
        docType: customer.docType ?? 'CNPJ',
        document: customer.document ?? '',
        name: customer.name ?? '',
        ie: customer.ie ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        zip: customer.zip ?? '',
        address: customer.address ?? '',
        number: customer.number ?? '',
        district: customer.district ?? '',
        city: customer.city ?? '',
        cityCode: customer.cityCode ?? '',
        state: customer.state ?? '',
        emailFinanceiro: customer.emailFinanceiro ?? '',
        emailAdicional1: customer.emailAdicional1 ?? '',
        emailAdicional2: customer.emailAdicional2 ?? '',
        billingTerms: customer.billingTerms ?? 'dia15',
      })
  }, [editing, customer?.id])

  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const payload = { ...form }
    try {
      if (editing) {
        await update.mutateAsync({ id, data: payload })
      } else {
        await create.mutateAsync(payload)
      }
      nav('/customers')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro desconhecido'
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    }
  }
if (editing && !customer) {
  return <p className="text-sm text-slate-500 p-4">Carregando cliente...</p>
}
  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        sub="Dados cadastrais do destinatário"
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

      <FormField label="Razão social / Nome" required>
        <input
          className="border rounded px-3 py-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </FormField>

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
        <FormField label="Cód. IBGE" title="Preenchido automaticamente na importação de NF">
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.cityCode}
            maxLength={7}
            onChange={(e) => setForm({ ...form, cityCode: e.target.value })}
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

      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2 pb-2 border-b border-slate-100">Cobrança</div>
      <FormField label="Prazo de vencimento">
        <select
          className="border rounded px-3 py-2 w-full"
          value={form.billingTerms}
          onChange={(e) => setForm({ ...form, billingTerms: e.target.value })}
        >
          <option value="dia15">Vencimento dia 15 do mês seguinte (acúmulo mensal)</option>
          <option value="dia20">Vencimento dia 20 do mês seguinte (acúmulo mensal)</option>
          <option value="7d">Vencimento em 7 dias após emissão</option>
          <option value="15d">Vencimento em 15 dias após emissão</option>
          <option value="28d">Vencimento em 28 dias após emissão</option>
          <option value="45d">Vencimento em 45 dias após emissão</option>
          <option value="15d+28d+45d">3 parcelas: d+15 / d+28 / d+45</option>
          <option value="30d+60d">2 parcelas: d+30 / d+60</option>
          <option value="30d+60d+90d">3 parcelas: d+30 / d+60 / d+90</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {form.billingTerms === 'dia15' || form.billingTerms === 'dia20'
            ? 'Todas as NFs do mês são consolidadas em uma única duplicata emitida no último dia do mês.'
            : form.billingTerms?.includes('+')
            ? 'Valor da NF dividido em parcelas iguais — cria um recebível e uma duplicata por parcela.'
            : 'Uma duplicata por NF emitida, vencendo conforme o prazo selecionado.'}
        </p>
      </FormField>

      {editing && customer && (
        <div className="flex gap-6 text-xs text-slate-400 pt-1">
          <span>Criado em: {new Date(customer.createdAt).toLocaleString('pt-BR')}</span>
          <span>Atualizado em: {new Date(customer.updatedAt).toLocaleString('pt-BR')}</span>
        </div>
      )}
      </div>

      {submitError && (
        <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
        <button
          className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700"
          type="submit"
          disabled={create.isPending || update.isPending}
        >
          {editing ? 'Salvar alterações' : 'Criar cliente'}
        </button>
        <button
          className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
          type="button"
          onClick={() => nav('/customers')}
        >
          Cancelar
        </button>
      </div>
    </form>
    </div>
  )
}
