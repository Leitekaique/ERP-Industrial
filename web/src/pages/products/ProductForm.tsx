import { useNavigate, useParams } from 'react-router-dom'
import { useCreateProduct, useProduct, useUpdateProduct } from '../../lib/useApi'
import { useEffect, useState, useMemo } from 'react'
import { FormField } from '../../components/FormField'
import { useEmpresasOrigem } from '../../lib/useEmpresasOrigem'
import { useProcessesLite } from '../../lib/useProcesses'
import { api } from '../../lib/api'


export default function ProductForm() {
  const tenantId = 'T-001'
  const companyId = 'C-001'

  const nav = useNavigate()
  const { id } = useParams()
  const editing = !!id

  const { data: product, isLoading } = useProduct(id)
  const create = useCreateProduct()
  const update = useUpdateProduct(id || '')

  /* =========================
     Estados gerais do produto
     ========================= */
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('M')
  const [price, setPrice] = useState<number | ''>('')
  const [ncm, setNcm] = useState('')
  const [cfop, setCfop] = useState('')
  const [csosn, setCsosn] = useState('')
  const [cest, setCest] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [processId, setProcessId] = useState<string | undefined>()

  const { data: empresas = [] } = useEmpresasOrigem({ tenantId, companyId })
  const { data: processos = [] } = useProcessesLite({
    tenantId,
    companyId,
    empresaId,
  })



  const [valorCompra, setValorCompra] = useState(0)
  const [largura, setLargura] = useState('')
  const [margem, setMargem] = useState('')


  /* =========================
     Valor final (apenas visual, read only)
     ========================= */
  const valorFinalCalculado = useMemo(() => {
    const compra = Number(valorCompra)
    const margemNum = Number(margem)
    const larg = Number(largura)

    if (!compra || larg <= 0) return ''

    return (compra * larg * (1 + margemNum / 100)).toFixed(2)
  }, [valorCompra, largura, margem])

// Cálculo é apenas sugestão — não sobrescreve o preço automaticamente

  /* =========================
     Load edição
     ========================= */
  useEffect(() => {
    if (product && editing) {
      setSku(product.sku)
      setName(product.name)
      setUnit(product.unit ?? 'M')
      setPrice(Number(product.price))
      setValorCompra(Number(product.price))
      setNcm(product.ncm ?? '')
      setCfop(product.cfop ?? '')
      setCsosn(product.taxes?.csosn ?? '')
      setCest(product.taxes?.cest ?? '')
      setEmpresaId(product.empresaOrigem?.id ?? '')
      setProcessId(product.processId ?? undefined)
    }
  }, [product, editing])

  /* =========================
     Submit
     ========================= */
  async function submit(e: React.FormEvent) {
    e.preventDefault()
	
	  if (!price || Number(price) <= 0) {
    alert('Preço inválido')
    return
  }

    const payload: any = {
      sku,
      name,
      unit,
      price: Number(price),
      ncm,
      cfop,
      empresaId,
      taxes: { csosn, ...(cest ? { cest } : {}) },
    }

    if (processId) payload.processId = processId
    if (editing) {
      await update.mutateAsync(payload)
    } else {
      await create.mutateAsync(payload)
    }


    nav('/products')
  }

  if (editing && isLoading) return <p>Carregando...</p>

  /* =========================
     Render
     ========================= */
const hasPMO = !!processId
const isInsumo = product?.empresaTipo === 'SUPPLIER'

const unitReadonly = editing || hasPMO
const priceReadonly = hasPMO

  return (
    <div className="space-y-4 max-w-xl">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{editing ? 'Editar produto' : 'Novo produto'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cadastro de produto e configurações fiscais</p>
      </div>
    </div>
    <form className="bg-white rounded-xl border border-slate-200 overflow-hidden" onSubmit={submit}>
      <div className="p-6 space-y-3">

      <FormField label="SKU">
        <input
          className="border rounded px-3 py-2 w-full"
          value={sku}
          onChange={e => setSku(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Nome">
        <input
          className="border rounded px-3 py-2 w-full"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Empresa (origem)">
        <select
          className="border rounded px-3 py-2 w-full"
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value)}
        >
          <option value="">Selecionar</option>
          {empresas.map(e => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.tipo})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Processo">
        <select
          className="border rounded px-3 py-2 w-full"
          value={processId ?? ''}
          onChange={e => setProcessId(e.target.value || undefined)}
        >
          <option value="">Nenhum</option>
          {processos.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — R$ {Number(p.price).toFixed(2)}/{p.unit}
            </option>
          ))}
        </select>
      </FormField>
<FormField label="Unidade">
  <select
    className="border rounded px-3 py-2 w-full"
    value={unit}
    onChange={e => setUnit(e.target.value)}
    disabled={unitReadonly}
  >
    <option value="M">Metro</option>
    <option value="KG">Kg</option>
    <option value="UN">Unidade</option>
  </select>
</FormField>

      {product?.empresaTipo === 'SUPPLIER' && (
        <>
          <h3 className="text-sm font-semibold mt-4 text-gray-800">
            🔁 Transformação de Insumo
          </h3>


          <FormField label= "Largura">
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 w-full"
              value={largura}
              onChange={e => setLargura(e.target.value)}
              
            />
          </FormField>

          <FormField label="Margem (%)">
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 w-full"
              value={margem}
              onChange={e => setMargem(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="💰 Valor de compra">
              <input
                className="border rounded px-3 py-2 w-full bg-gray-100"
                value={`R$ ${valorCompra.toFixed(2)}`}
                disabled
              />
            </FormField>

            <FormField label="💰 Valor calculado">
              <div className="flex gap-2">
                <input
                  readOnly
                  className="border rounded px-3 py-2 flex-1 bg-gray-100"
                  value={valorFinalCalculado ? `R$ ${valorFinalCalculado}` : '—'}
                />
                {valorFinalCalculado && (
                  <button
                    type="button"
                    className="px-3 py-2 bg-tapajos-600 text-white text-xs rounded hover:bg-tapajos-700"
                    onClick={() => setPrice(Number(valorFinalCalculado))}
                  >
                    Aplicar
                  </button>
                )}
              </div>
            </FormField>
          </div>
        </>
      )}

      <FormField label="Preço">
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-2 w-full"
          value={price === '' ? '' : Number(price)}
          disabled={priceReadonly}
          onChange={e => setPrice(Number(e.target.value))}
          required
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="NCM">
          <input
            className="border rounded px-3 py-2 w-full"
            value={ncm}
            onChange={e => setNcm(e.target.value)}
          />
        </FormField>

        <FormField label="CFOP">
          <input
            className="border rounded px-3 py-2 w-full"
            value={cfop}
            onChange={e => setCfop(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="CSOSN (Tributação)">
          <input
            className="border rounded px-3 py-2 w-full"
            value={csosn}
            onChange={e => setCsosn(e.target.value)}
          />
        </FormField>

        <FormField label="CEST" hint="Obrigatório para produtos com Substituição Tributária (ex: venda de malha)">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="ex: 10.001.00"
            value={cest}
            onChange={e => setCest(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </FormField>
      </div>

      {editing && product && (
        <div className="flex gap-6 text-xs text-slate-400 pt-1">
          <span>Criado em: {new Date(product.createdAt).toLocaleString('pt-BR')}</span>
          {product.updatedAt && <span>Atualizado em: {new Date(product.updatedAt).toLocaleString('pt-BR')}</span>}
        </div>
      )}
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
        <button className="px-4 py-2 bg-tapajos-600 text-white rounded text-sm hover:bg-tapajos-700" type="submit">
          {editing ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <button type="button" className="px-4 py-2 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => nav('/products')}>
          Cancelar
        </button>
      </div>
    </form>
    </div>
  )
}
