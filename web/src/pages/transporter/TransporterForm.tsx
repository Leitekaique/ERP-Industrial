import { useEffect, useState } from 'react'
import { useApi, useTransporter, useUpdateTransporter } from '../../lib/useApi'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'

function onlyDigits(v: string) {
  return (v ?? '').replace(/\D/g, '')
}

export default function TransporterForm() {
  const navigate = useNavigate()
  const api = useApi()
  const { id } = useParams<{ id: string }>()
  const editing = !!id && id !== 'new'
  const { data: existing } = useTransporter(editing ? id : undefined)
  const updateMutation = useUpdateTransporter()

  const tenantId = import.meta.env.VITE_TENANT_ID
  const companyId = import.meta.env.VITE_COMPANY_ID

  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [rntrc, setRntrc] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [number, setNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [complement, setComplement] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    setName(existing.name ?? '')
    setCnpj(existing.cnpj ?? '')
    setRntrc(existing.rntrc ?? '')
    setEmail(existing.email ?? '')
    setPhone(existing.phone ?? '')
    setAddress(existing.address ?? '')
    setNumber(existing.number ?? '')
    setDistrict(existing.district ?? '')
    setCity(existing.city ?? '')
    setState(existing.state ?? '')
    setZip(existing.zip ?? '')
    setComplement(existing.complement ?? '')
  }, [existing?.id])

  const salvar = async () => {
    setError(null)
    const doc = onlyDigits(cnpj)

    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    if (!(doc.length === 11 || doc.length === 14)) {
      setError('CPF/CNPJ inválido. Use 11 (CPF) ou 14 (CNPJ) dígitos.')
      return
    }

    const payload = {
      name: name.trim(),
      cnpj: doc,
      rntrc: rntrc?.trim() || undefined,
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      number: number?.trim() || undefined,
      district: district?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      zip: onlyDigits(zip) || undefined,
      complement: complement?.trim() || undefined,
    }

    try {
      setSaving(true)
      if (editing) {
        await updateMutation.mutateAsync({ id: id!, data: payload })
      } else {
        await api.post('/transporter', { tenantId, companyId, ...payload })
      }
      navigate('/transporter')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao salvar transportadora.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={editing ? 'Editar Transportadora' : 'Nova Transportadora'}
        sub="Cadastro de transportadora"
      >
        <button
          className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50"
          onClick={() => navigate(-1)}
          type="button"
        >
          Voltar
        </button>
      </PageHeader>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block mb-1 text-sm text-slate-600">Nome *</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Transportadora X"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">CPF/CNPJ (somente números) *</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={cnpj}
              onChange={e => setCnpj(onlyDigits(e.target.value))}
              placeholder="11 (CPF) ou 14 (CNPJ)"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">RNTRC (opcional)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={rntrc}
              onChange={e => setRntrc(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Email (opcional)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Telefone (opcional)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <label className="block mb-1 text-sm text-slate-600">Endereço</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Número</label>
            <input className="border rounded px-3 py-2 w-full" value={number} onChange={e => setNumber(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Bairro</label>
            <input className="border rounded px-3 py-2 w-full" value={district} onChange={e => setDistrict(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Cidade</label>
            <input className="border rounded px-3 py-2 w-full" value={city} onChange={e => setCity(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">UF</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={state}
              onChange={e => setState(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">CEP</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={zip}
              onChange={e => setZip(onlyDigits(e.target.value))}
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-slate-600">Complemento</label>
            <input className="border rounded px-3 py-2 w-full" value={complement} onChange={e => setComplement(e.target.value)} />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button
            className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700 disabled:opacity-60"
            onClick={salvar}
            disabled={saving}
            type="button"
          >
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar transportadora'}
          </button>
          <button
            className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => navigate('/transporter')}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
