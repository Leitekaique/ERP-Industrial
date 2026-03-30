import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCustomers, useSuppliers, useNfeCreateDraftFromStock } from '../../lib/useApi'
import { api } from '../../lib/api'

const tenantId = String(import.meta.env.VITE_TENANT_ID ?? 'T-001')
const companyId = String(import.meta.env.VITE_COMPANY_ID ?? 'C-001')

const toPtNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const s = String(value).trim()
  if (!s) return 0
  const normalized = s.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

const normalizePtInput = (raw: string) => {
  const cleaned = raw.replace(/[^\d,]/g, '')
  const parts = cleaned.split(',')
  if (parts.length <= 1) return cleaned
  return `${parts[0]},${parts.slice(1).join('')}`
}

export default function NfeForm() {
  const nav = useNavigate()
  const createDraft = useNfeCreateDraftFromStock()

  const { data: customers = [] } = useCustomers('')
  const { data: suppliers = [] } = useSuppliers('')

  const { data: nextNumData } = useQuery({
    queryKey: ['nfe-next-number', tenantId, companyId],
    queryFn: async () =>
      (await api.get('/nfe-emit/next-number', { params: { tenantId, companyId } })).data as { nextNumber: number },
    staleTime: 30_000,
  })

  const [recipientTipo, setRecipientTipo] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
  const [recipientId, setRecipientId] = useState<string>('')
  const [observacoes, setObservacoes] = useState('')

  const [items, setItems] = useState<any[]>([{
    productId: null, sku: '', description: '', cfop: '', ncm: '',
    qty: '1', unit: 'UN', unitPrice: '0', csosn: '400', taxes: {}, meta: { kind: 'MANUAL' },
  }])

  const selectedRecipient = useMemo(() => {
    const lista = recipientTipo === 'CUSTOMER' ? customers : suppliers
    return (lista as any[]).find((x: any) => x.id === recipientId) ?? null
  }, [recipientId, recipientTipo, customers, suppliers])

  const onChangeItem = (idx: number, patch: any) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const onRemoveItem = (idx: number) => {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const onAddItem = () => {
    setItems(prev => [
      ...prev,
      { productId: null, sku: '', description: '', cfop: '', ncm: '',
        qty: '1', unit: 'UN', unitPrice: '0', csosn: '400', taxes: {}, meta: { kind: 'MANUAL' } },
    ])
  }

  const totals = useMemo(() => {
    let total = 0
    for (const it of items) {
      total += toPtNumber(it.qty) * toPtNumber(it.unitPrice)
    }
    return total
  }, [items])

  const onCreateDraft = async () => {
    if (!recipientId) { alert('Selecione o destinatário.'); return }

    const itemsPayload = items.map((it: any) => ({
      productId: it.productId ?? null,
      sku: it.sku || null,
      description: it.description ?? '',
      cfop: it.cfop || null,
      ncm: it.ncm || null,
      qty: toPtNumber(it.qty),
      unit: it.unit || null,
      unitPrice: toPtNumber(it.unitPrice),
      taxes: { ...(it.taxes ?? {}), csosn: it.csosn || '400' },
      csosn: it.csosn || '400',
      meta: it.meta ?? { kind: 'MANUAL' },
    }))

    const payload: any = {
      tenantId, companyId,
      recipient: { tipo: recipientTipo, id: recipientId },
      items: itemsPayload,
      itens: itemsPayload,
      observacoes: observacoes || null,
    }

    const draft = await createDraft.mutateAsync(payload)
    const draftId = draft?.id ?? draft?.data?.id
    if (draftId) {
      nav(`/nfe-emit/${draftId}`)
    } else {
      nav('/nfe-emit')
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nova NF-e manual</h1>
          <p className="text-xs text-gray-500 mt-0.5">Preencha o destinatário e os itens, depois clique em "Criar rascunho" para revisar e emitir.</p>
          {nextNumData?.nextNumber && (
            <p className="text-xs text-gray-500 mt-0.5" title="O número pode mudar se outra NF for emitida antes desta.">
              Próximo Nº previsto: <span className="font-mono">{String(nextNumData.nextNumber).padStart(9, '0')}</span>
            </p>
          )}
        </div>
        <button className="px-3 py-2 border rounded text-sm bg-white hover:bg-gray-50 shrink-0" onClick={() => nav(-1)}>
          Voltar
        </button>
      </div>

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
                setRecipientId('')
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
              {(recipientTipo === 'CUSTOMER' ? customers : suppliers as any[]).map((x: any) => (
                <option key={x.id} value={x.id}>{x.nome ?? x.name}</option>
              ))}
            </select>
          </div>
        </div>

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
          <thead className="bg-gray-50 sticky top-0 border-b">
            <tr>
              <th className="p-1 text-center w-4" />
              <th className="p-1 text-center w-24" title="Código interno do produto">SKU</th>
              <th className="p-1 text-center" title="Nome do produto na NF-e">Descrição</th>
              <th className="p-1 text-center w-12" title="Código Fiscal da Operação — beneficiamento SP→SP: 5124">CFOP</th>
              <th className="p-1 text-center w-20" title="Nomenclatura Comum do Mercosul — 8 dígitos">NCM</th>
              <th className="p-1 text-center w-12" title="Código de Situação da Operação — Simples Nacional sem destaque ICMS: 400">CSOSN</th>
              <th className="p-1 text-center w-24" title="Quantidade (use vírgula como decimal)">Qtd</th>
              <th className="p-1 text-center w-10" title="Unidade de medida: KG, MT, UN, PC...">Un</th>
              <th className="p-1 text-center w-20" title="Valor unitário em R$ (use vírgula)">V. Unit</th>
              <th className="p-1 text-center w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const lineTotal = toPtNumber(it.qty) * toPtNumber(it.unitPrice)
              return (
                <tr key={idx} className="border-t">
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      className="h-4 w-4 inline-flex items-center justify-center rounded border hover:bg-gray-50 text-gray-600"
                      title="Remover item"
                      onClick={() => onRemoveItem(idx)}
                    >
                      ✕
                    </button>
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-center" value={it.sku ?? ''} onChange={e => onChangeItem(idx, { sku: e.target.value })} />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs" value={it.description ?? ''} onChange={e => onChangeItem(idx, { description: e.target.value })} />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-center font-mono" value={it.cfop ?? ''} onChange={e => onChangeItem(idx, { cfop: e.target.value })} placeholder="5124" />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-center font-mono" value={it.ncm ?? ''} onChange={e => onChangeItem(idx, { ncm: e.target.value })} placeholder="63079090" />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-center font-mono" value={it.csosn ?? '400'} onChange={e => onChangeItem(idx, { csosn: e.target.value })} placeholder="400" />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-right" value={it.qty ?? ''} onChange={e => onChangeItem(idx, { qty: normalizePtInput(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-center" value={it.unit ?? ''} onChange={e => onChangeItem(idx, { unit: e.target.value })} placeholder="UN" />
                  </td>
                  <td className="p-1">
                    <input className="w-full border rounded px-1 py-1 text-xs text-right" value={it.unitPrice ?? ''} onChange={e => onChangeItem(idx, { unitPrice: normalizePtInput(e.target.value) })} />
                  </td>
                  <td className="p-1 text-right pr-2 font-medium text-gray-800">
                    {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50" onClick={onAddItem}>
          + Adicionar item
        </button>
        <span className="ml-auto text-sm text-gray-500">
          {items.length} item(ns) &bull; Total:&nbsp;
          <strong className="text-gray-900">
            {totals.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </span>
      </div>

      {/* Observações */}
      <div className="border rounded-lg p-4 space-y-2">
        <label className="block text-sm font-medium text-gray-700">Observações / Inf. Complementares</label>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm h-20"
          placeholder="Ex: Pedido nº 1234. Referência de processo. (Disclaimers do Simples Nacional são adicionados automaticamente)"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
        />
      </div>

      {/* Rodapé */}
      <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Total NF:</span>&nbsp;
          <span className="text-lg font-bold text-gray-900">
            {totals.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 border rounded text-sm bg-white hover:bg-gray-50" onClick={() => nav(-1)}>
            Cancelar
          </button>
          <button
            type="button"
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
    </div>
  )
}
