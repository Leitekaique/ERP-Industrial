import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useNfeCreateDraftFromStock, useCompany } from '../../lib/useApi'
import { api } from '../../lib/api'

export default function NfeEmitFromStockPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const createDraft = useNfeCreateDraftFromStock()

  const state: any = (loc as any).state ?? {}
  const preview = state.preview

  const tenantId = String(state.tenantId ?? import.meta.env.VITE_TENANT_ID ?? '')
  const companyId = String(state.companyId ?? import.meta.env.VITE_COMPANY_ID ?? '')

  const { data: company } = useCompany(companyId)

  const { data: nextNumData } = useQuery({
    queryKey: ['nfe-next-number', tenantId, companyId],
    queryFn: async () =>
      (await api.get('/nfe-emit/next-number', { params: { tenantId, companyId } })).data as { nextNumber: number },
    staleTime: 30_000,
  })

  if (!preview) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-600">
          Preview não encontrado (abra esta tela pela StockPage).
        </div>
      </div>
    )
  }

  const customers = preview?.recipients?.customers ?? []
  const suppliers = preview?.recipients?.suppliers ?? []

  const defaultRecipient = preview?.defaultRecipient ?? null
  const defaultRecipientTipo =
    defaultRecipient?.tipo === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER'

  const defaultRecipientId =
    defaultRecipient?.id ??
    (defaultRecipientTipo === 'CUSTOMER' ? customers[0]?.id : suppliers[0]?.id) ??
    ''

  const [recipientTipo, setRecipientTipo] = useState<'CUSTOMER' | 'SUPPLIER'>(defaultRecipientTipo)
  const [recipientId, setRecipientId] = useState<string>(defaultRecipientId)

  const [observacoes, setObservacoes] = useState<string>('')
  const [items, setItems] = useState<any[]>(() =>
    (preview.items ?? []).map((it: any) => ({
      ...it,
      qty: it.qty != null ? String(it.qty).replace('.', ',') : '',
      unitPrice: it.unitPrice != null ? String(it.unitPrice).replace('.', ',') : '',
    }))
  )

  const onChangeItem = (idx: number, patch: any) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const onRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }
  const onRemoveItemConfirm = (idx: number) => {
	  const it = items[idx]
	  const sku = String(it?.sku ?? it?.meta?.sku ?? '-')
	  const ok = window.confirm(`Quer excluir esse sku: ${sku}?`)
	  if (!ok) return
	  onRemoveItem(idx)
	  }


  const onAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        productId: null,
        sku: '',
        description: '',
        cfop: '',
        ncm: '',
        qty: 0,
        unit: '',
        unitPrice: 0,
        taxes: {},
        csosn: '',
        meta: { kind: 'MANUAL' },
      },
    ])
  }
	const toPtNumber = (value: any): number => {
	  if (value === null || value === undefined) return 0
	  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

	  const s = String(value).trim()
	  if (!s) return 0

	  // remove separador de milhar e troca vírgula por ponto
	  const normalized = s.replace(/\./g, '').replace(',', '.')
	  const n = Number(normalized)
	  return Number.isFinite(n) ? n : 0
	}

	// formata para mostrar no input (mantém vírgula)
	const normalizePtInput = (raw: string) => {
	  // permite "1", "1,", "1,2", "1,23" etc
	  // remove qualquer coisa que não seja dígito ou vírgula
	  const cleaned = raw.replace(/[^\d,]/g, '')
	  // mantém só a primeira vírgula
	  const parts = cleaned.split(',')
	  if (parts.length <= 1) return cleaned
	  return `${parts[0]},${parts.slice(1).join('')}`
	}


  const totals = useMemo(() => {
    let totalPmo = 0
    let totalProdutos = 0

    for (const it of items) {
      const lineTotal = toPtNumber(it.qty ?? 0) * toPtNumber(it.unitPrice ?? 0)
      const isPmo = (it?.meta?.kind ?? '') === 'PMO'
      if (isPmo) totalPmo += lineTotal
      else totalProdutos += lineTotal
    }

    return {
      totalPmo,
      totalProdutos,
      totalNf: totalPmo + totalProdutos,
    }
  }, [items])

  const onCreateDraft = async () => {
    if (!recipientId) return

	const itemsPayload = (items ?? []).map((it: any) => ({
	  productId: it.productId ?? null,
	  sku: it.sku ?? it?.meta?.sku ?? null,

	  description: it.description ?? '',
	  cfop: it.cfop ?? null,
	  ncm: it.ncm ?? null,

	  qty: toPtNumber(it.qty ?? 0),
	  unit: it.unit ?? null,
	  unitPrice: toPtNumber(it.unitPrice ?? 0),

	  taxes: { ...(it.taxes ?? {}), csosn: it.csosn ?? it?.taxes?.csosn ?? null },
	  csosn: it.csosn ?? it?.taxes?.csosn ?? null,

	  meta: it.meta ?? null,
	}))

	const payload: any = {
	  tenantId,
	  companyId,

	  recipient: { tipo: recipientTipo, id: recipientId },

	  // ✅ manda os dois nomes pra não depender do dto atual
	  items: itemsPayload,
	  itens: itemsPayload,

	  observacoes: observacoes ?? null,
	}

	console.log('items state length', items?.length, items)
	await createDraft.mutateAsync(payload)
    nav('/inventory/stock')
  }

  // Dados do destinatário selecionado (para exibir detalhes)
  const selectedRecipient = useMemo(() => {
    const lista = recipientTipo === 'CUSTOMER' ? customers : suppliers
    return lista.find((x: any) => x.id === recipientId) ?? null
  }, [recipientId, recipientTipo, customers, suppliers])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Criar rascunho de NF-e</h1>
          <p className="text-xs text-gray-500 mt-0.5">Revise os itens e selecione o destinatário antes de criar o rascunho.</p>
          {nextNumData?.nextNumber && (
            <p className="text-xs text-gray-500 mt-0.5" title="O número pode mudar se outra NF for emitida antes desta.">
              Próximo Nº previsto: <span className="font-mono">{String(nextNumData.nextNumber).padStart(9, '0')}</span>
            </p>
          )}
          {preview?.warnings?.length ? (
            <div className="mt-1 space-y-0.5">
              {preview.warnings.map((w: string, i: number) => (
                <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ {w}</div>
              ))}
            </div>
          ) : null}
        </div>
        <button
          className="px-3 py-2 border rounded text-sm bg-white hover:bg-gray-50 shrink-0"
          onClick={() => nav(-1)}
        >
          Voltar
        </button>
      </div>

      {/* EMITENTE */}
      {company && (
        <div className="border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-gray-800 text-sm">Emitente</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-blue-50 rounded border border-blue-100 text-sm">
            <div className="md:col-span-2">
              <span className="block text-xs text-gray-500 mb-0.5">Razão social</span>
              <span className="font-medium text-gray-800">{company.legalName ?? company.tradeName ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">Nome fantasia</span>
              <span className="font-medium text-gray-800">{company.tradeName ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">CNPJ</span>
              <span className="font-medium text-gray-800">{company.cnpj ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">IE</span>
              <span className="font-medium text-gray-800">{company.ie ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">CRT</span>
              <span className="font-medium text-gray-800">{company.crt ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">Alíq. crédito ICMS SN</span>
              <span className="font-medium text-gray-800">{company.icmsSnRate != null ? `${Number(company.icmsSnRate).toFixed(2)}%` : '—'}</span>
            </div>
            <div className="md:col-span-4">
              <span className="block text-xs text-gray-500 mb-0.5">Endereço</span>
              <span className="font-medium text-gray-800">
                {[company.address, company.number, company.district, company.city, company.uf, company.zip ? `CEP ${company.zip}` : null]
                  .filter(Boolean).join(', ') || '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DESTINATÁRIO */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Destinatário <span className="text-red-500">*</span></h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Tipo de destinatário</span>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={recipientTipo}
              onChange={e => {
                const tipo = e.target.value as 'CUSTOMER' | 'SUPPLIER'
                setRecipientTipo(tipo)
                const nextId =
                  tipo === 'CUSTOMER' ? (customers[0]?.id ?? '') : (suppliers[0]?.id ?? '')
                setRecipientId(nextId)
              }}
            >
              <option value="CUSTOMER">Cliente</option>
              <option value="SUPPLIER">Fornecedor</option>
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">
              {recipientTipo === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'} <span className="text-red-500">*</span>
            </span>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
            >
              <option value="">— Selecione —</option>
              {recipientTipo === 'CUSTOMER'
                ? customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome ?? c.name}</option>
                  ))
                : suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nome ?? s.name}</option>
                  ))}
            </select>
          </div>
        </div>

        {/* Detalhes do destinatário selecionado */}
        {selectedRecipient && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 p-3 bg-gray-50 rounded border text-sm">
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">CNPJ / CPF</span>
              <span className="font-medium text-gray-800">{selectedRecipient.document ?? selectedRecipient.cnpj ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">IE</span>
              <span className="font-medium text-gray-800">{selectedRecipient.ie ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">E-mail</span>
              <span className="font-medium text-gray-800">{selectedRecipient.email ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">UF</span>
              <span className="font-medium text-gray-800">{selectedRecipient.state ?? selectedRecipient.uf ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">Telefone</span>
              <span className="font-medium text-gray-800">{selectedRecipient.phone ?? '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 mb-0.5">Bairro</span>
              <span className="font-medium text-gray-800">{selectedRecipient.district ?? '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Guia de campos dos itens */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
        <div className="font-semibold mb-1">Guia dos campos dos itens:</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
          <span><strong>SKU:</strong> Código interno do produto no estoque</span>
          <span><strong>Descrição:</strong> Nome do produto que vai na NF (máx. 120 caracteres)</span>
          <span><strong>CFOP:</strong> Código Fiscal da Operação. Beneficiamento: <strong>5124</strong> (SP→SP) ou <strong>6124</strong> (SP→outro estado). Remessa industrialização: <strong>5901/6901</strong></span>
          <span><strong>NCM:</strong> Nomenclatura Comum do Mercosul — 8 dígitos. Identifica o tipo do produto perante a Receita Federal</span>
          <span><strong>CSOSN:</strong> Regime tributário do item. Simples Nacional sem destaque de ICMS: <strong>400</strong>. Com crédito: <strong>101</strong></span>
          <span><strong>Qtd:</strong> Quantidade na unidade informada. Use vírgula como decimal (ex: 1,5)</span>
          <span><strong>Un:</strong> Unidade de medida (KG, MT, M², UN, PC, etc.)</span>
          <span><strong>V. Unit:</strong> Valor unitário em R$. Use vírgula (ex: 12,50)</span>
        </div>
      </div>

      {/* ITEMS */}
      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm table-fixed">
		<thead className="bg-gray-50 sticky top-0">
		  <tr>
			<th className="p-1 text-center w-4" />
			<th className="p-1 text-center w-26" title="Código interno do produto">SKU</th>
			<th className="p-1 text-center" title="Nome do produto na NF-e">Descrição</th>
			<th className="p-1 text-center w-12" title="Código Fiscal da Operação — beneficiamento SP→SP: 5124">CFOP</th>
			<th className="p-1 text-center w-20" title="Nomenclatura Comum do Mercosul — 8 dígitos">NCM</th>
			<th className="p-1 text-center w-8" title="Código de Situação da Operação — Simples Nacional sem destaque ICMS: 400">CSOSN</th>
			<th className="p-1 text-center w-24" title="Quantidade (use vírgula como decimal)">Qtd</th>
			<th className="p-1 text-center w-10" title="Unidade de medida: KG, MT, UN, PC...">Un</th>
			<th className="p-1 text-center w-16" title="Valor unitário em R$ (use vírgula)">V. Unit</th>
			<th className="p-1 text-center w-26">Total</th>
		  </tr>
		</thead>
          <tbody>
            {items.map((it, idx) => {
              const lineTotal = toPtNumber(it.qty) * toPtNumber(it.unitPrice)

              return (
                <tr key={idx} className="border-t">
                  {/* REMOVE */}
				<td className="p-1 text-center w-4">
				  <button
					type="button"
					className="h-4 w-4 inline-flex items-center justify-center rounded border hover:bg-gray-50 text-gray-600"
					title="Remover item"
					onClick={() => onRemoveItemConfirm(idx)}
				  >
					✕
				  </button>
				</td>

				{/* SKU */}
				<td className="p-1 w-24">
				  <input
					className="w-full border rounded px-0 py-1 text-xs text-center"
					value={it.sku ?? it?.meta?.sku ?? ''}
					onChange={e => onChangeItem(idx, { sku: e.target.value })}
				  />
				</td>

				{/* Descrição (vai “pegar” o espaço que sobrar) */}
				<td className="p-1">
				  <input
					className="w-full border rounded px-0.1 py-1 text-xs"
					value={it.description ?? ''}
					onChange={e => onChangeItem(idx, { description: e.target.value })}
				  />
				</td>

				{/* CFOP */}
				<td className="p-1 w-12">
				  <input
					className="w-full border rounded px-1 py-1 text-sm text-center"
					value={it.cfop ?? ''}
					onChange={e => onChangeItem(idx, { cfop: e.target.value })}
				  />
				</td>

				{/* NCM */}
				<td className="p-1 w-20">
				  <input
					className="w-full border rounded px-1 py-1 text-sm text-center"
					value={it.ncm ?? ''}
					onChange={e => onChangeItem(idx, { ncm: e.target.value })}
				  />
				</td>

				{/* CSOSN */}
				<td className="p-1 w-8">
				  <input
					className="w-full border rounded px-2 py-1 text-sm text-center"
					value={it.csosn ?? it?.taxes?.csosn ?? ''}
					onChange={e => {
					  const csosn = e.target.value
					  onChangeItem(idx, { csosn, taxes: { ...(it.taxes ?? {}), csosn } })
					}}
				  />
				</td>

				{/* Qtd */}
				<td className="p-1 w-26">
				  <input
					className="w-full border rounded px-0 py-1 text-sm text-center"
					inputMode="decimal"
					value={it.qty ?? ''}
					onChange={e => {
					  const v = normalizePtInput(e.target.value)
					  onChangeItem(idx, { qty: v })
					}}
				  />
				</td>

				{/* Un */}
				<td className="p-1 w-10">
				  <input
					className="w-full border rounded px-0 py-1 text-sm text-center"
					value={it.unit ?? ''}
					onChange={e => onChangeItem(idx, { unit: e.target.value })}
				  />
				</td>

				{/* V. Unit */}
				<td className="p-1 w-16">
				  <input
					className="w-full border rounded px-0 py-1 text-sm text-center"
					inputMode="decimal"
					value={it.unitPrice ?? ''}
					onChange={e => {
					  const v = normalizePtInput(e.target.value)
					  onChangeItem(idx, { unitPrice: v })
					}}
				  />
				</td>

				{/* Total — largura fixa igual Qtd */}
				<td className="p-1 text-center w-26">
				  {lineTotal.toFixed(2).replace('.', ',')}
				</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ADD ITEM */}
      <div className="flex justify-end">
        <button
          type="button"
          className="px-3 py-1 border rounded text-sm bg-white hover:bg-gray-50"
          onClick={onAddItem}
        >
          + Adicionar item
        </button>
      </div>

      {/* OBSERVAÇÕES */}
      <div className="border rounded-lg p-4 space-y-2">
        <span className="block text-sm font-medium text-gray-700">Observações / Informações adicionais</span>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
          placeholder="Ex.: Referente ao processo nº 123. Mercadoria enviada via transportadora X."
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
        />
      </div>

      {/* FOOTER */}
      <div className="border rounded-lg px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5 text-sm text-gray-700">
          <span><span className="text-gray-500">Itens:</span> <strong>{items.length}</strong></span>
          {totals.totalPmo > 0 && (
            <span><span className="text-gray-500">PMO:</span> <strong>R$ {totals.totalPmo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
          )}
          <span><span className="text-gray-500">Produtos:</span> <strong>R$ {totals.totalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
          <span><span className="text-gray-500">Total NF:</span> <strong>R$ {totals.totalNf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
        </div>

        <button
          disabled={!recipientId || createDraft.isPending}
          className={`px-5 py-2 rounded text-sm font-medium ${
            recipientId && !createDraft.isPending
              ? 'bg-tapajos-600 text-white hover:bg-tapajos-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          onClick={onCreateDraft}
        >
          {createDraft.isPending ? 'Criando rascunho…' : 'Criar rascunho de NF-e'}
        </button>
      </div>
    </div>
  )
}
