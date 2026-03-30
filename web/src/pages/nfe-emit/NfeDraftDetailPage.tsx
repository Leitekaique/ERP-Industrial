import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useTransportersList } from '../../lib/useApi'

function toPtMoney(v: any) {
  const n = Number(v ?? 0)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// a45 — normaliza vírgula→ponto antes de converter para número
function parseDecimal(v: string): number {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// Formata número para campo de input (vírgula decimal, SEM separador de milhar)
function fmtDecimalInput(v: string | number, decimals = 2): string {
  const n = typeof v === 'number' ? v : parseDecimal(String(v))
  if (isNaN(n)) return String(v)
  return n.toFixed(decimals).replace('.', ',')
}

// Handler onChange que aceita apenas dígitos, vírgula e ponto
function decimalOnChange(setter: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (/^\d*[,.]?\d*$/.test(v)) setter(v)
  }
}

function toPtDateTime(d: any) {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR')
}

function sumQty(items: any[]) {
  if (!Array.isArray(items)) return 0
  return items.reduce((acc, it) => acc + Number(it?.qty ?? 0), 0)
}

function fieldIsLocked(value: any) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return true
  return true
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>}
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      <div className="px-3 py-2 bg-gray-50 border rounded text-sm text-gray-800 min-h-[36px]">
        {value || <span className="text-gray-400 italic">—</span>}
      </div>
    </div>
  )
}

const BILLING_TERMS_LABEL: Record<string, string> = {
  dia15: 'Acumulado — vence dia 15 do mês seguinte',
  dia20: 'Acumulado — vence dia 20 do mês seguinte',
  '7d':  'Por NF — 7 dias',
  '15d': 'Por NF — 15 dias',
  '28d': 'Por NF — 28 dias',
  '45d': 'Por NF — 45 dias',
}

export default function NfeDraftDetailPage() {
  const nav = useNavigate()
  const { id } = useParams()

  const tenantId = String(import.meta.env.VITE_TENANT_ID ?? 'T-001')
  const companyId = String(import.meta.env.VITE_COMPANY_ID ?? 'C-001')

  const [aba, setAba] = useState<'1' | '2' | '3' | '4' | '5'>('1')

  const { data: nfe, isLoading, error, refetch } = useQuery({
    queryKey: ['nfe-draft-detail', tenantId, companyId, id],
    queryFn: async () =>
      (await api.get(`/nfe-emit/${id}`, { params: { tenantId, companyId } })).data,
    enabled: !!id,
  })

  // a46 — próximo número da NF (exibido no header quando ainda é draft)
  const { data: nextNumData } = useQuery({
    queryKey: ['nfe-next-number', tenantId, companyId],
    queryFn: async () =>
      (await api.get('/nfe-emit/next-number', { params: { tenantId, companyId } })).data as { nextNumber: number },
    enabled: !!id,
    staleTime: 30_000,
  })

  const [naturezaOperacao, setNaturezaOperacao] = useState('')
  const [transportadoraId, setTransportadoraId] = useState('')

  const { data: transporters = [] } = useTransportersList({ tenantId, companyId })

  const [draftExtra, setDraftExtra] = useState({
    freightType: 'destinatario',
    vehiclePlate: '',
    vehicleUf: '',
    volumesQty: '',
    volumesSpecies: '',
    volumesBrand: '',
    weightNet: '',
    weightGross: '',
    freteValor: '',          // a58 — valor do frete cobrado pelo emitente
    cobrancaNumero: '001',
    cobrancaVencimento: '',
    cobrancaValor: '',
    pagamentoTipo: '01',
    informacoesAdicionais: '',
    refNFe: '',              // chave(s) da NF do cliente referenciada (NFref)
  })

  React.useEffect(() => {
    if (!nfe) return

    if (nfe.naturezaOperacao) setNaturezaOperacao(nfe.naturezaOperacao)

    const computeDueDate = (terms: string | null | undefined): string => {
      const d = new Date()
      if (!terms) { d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) }
      if (terms === 'dia15') { d.setMonth(d.getMonth() + 1); d.setDate(15); return d.toISOString().slice(0, 10) }
      if (terms === 'dia20') { d.setMonth(d.getMonth() + 1); d.setDate(20); return d.toISOString().slice(0, 10) }
      const m = terms.match(/^(\d+)d$/)
      if (m) { d.setDate(d.getDate() + parseInt(m[1], 10)); return d.toISOString().slice(0, 10) }
      d.setDate(d.getDate() + 30)
      return d.toISOString().slice(0, 10)
    }

    const billingTerms = nfe?.customer?.billingTerms ?? null
    const totalNF = Number(nfe?.totalInvoice ?? nfe?.totalProducts ?? 0)

    setDraftExtra(prev => ({
      ...prev,
      freightType: nfe?.freightType ?? prev.freightType,
      vehiclePlate: nfe?.vehiclePlate ?? prev.vehiclePlate,
      vehicleUf: nfe?.vehicleUf ?? prev.vehicleUf,
      volumesQty: nfe?.volumesQty != null ? String(nfe.volumesQty) : prev.volumesQty,
      volumesSpecies: nfe?.volumesSpecies ?? prev.volumesSpecies,
      volumesBrand: nfe?.volumesBrand ?? prev.volumesBrand,
      refNFe: (nfe as any)?.refNFe ?? prev.refNFe,
      weightNet: nfe?.weightNet != null ? fmtDecimalInput(Number(nfe.weightNet), 3) : prev.weightNet,
      weightGross: nfe?.weightGross != null ? fmtDecimalInput(Number(nfe.weightGross), 3) : prev.weightGross,
      cobrancaNumero: nfe?.number ? String(nfe.number).padStart(3, '0') : '001',
      cobrancaVencimento: computeDueDate(billingTerms),
      cobrancaValor: totalNF > 0 ? fmtDecimalInput(totalNF) : prev.cobrancaValor,
    }))
  }, [nfe])

  // a58 — quando o usuário preenche o frete, recalcula cobrancaValor
  React.useEffect(() => {
    if (!nfe) return
    const freteVal = parseDecimal(draftExtra.freteValor)
    if (freteVal <= 0) return
    const items: any[] = nfe.items ?? []
    const itemsTotal = items.reduce((acc: number, it: any) =>
      acc + Number(it?.total ?? (Number(it?.qty ?? 0) * Number(it?.unitPrice ?? 0) - Number(it?.discount ?? 0))), 0)
    setDraftExtra(prev => ({ ...prev, cobrancaValor: fmtDecimalInput(itemsTotal + freteVal) }))
  }, [draftExtra.freteValor]) // eslint-disable-line react-hooks/exhaustive-deps

  const [emitError, setEmitError] = React.useState<string | null>(null)
  const [emitSuccess, setEmitSuccess] = React.useState<{ nfeNum?: number } | null>(null)

  const emitMutation = useMutation({
    mutationFn: async () => {
      setEmitError(null)
      const selectedTransporter = transporters.find((t: any) => t.id === transportadoraId)
      const res = await api.post(`/nfe-emit/${id}/emit`, {
        tenantId,
        companyId,
        ...(naturezaOperacao.trim() ? { naturezaOperacao: naturezaOperacao.trim() } : {}),
        ...(selectedTransporter
          ? { transportadoraNome: selectedTransporter.name, transportadoraCnpj: selectedTransporter.cnpj }
          : {}),
        ...(draftExtra.freightType ? { freightType: draftExtra.freightType } : {}),
        ...(draftExtra.vehiclePlate ? { vehiclePlate: draftExtra.vehiclePlate } : {}),
        ...(draftExtra.vehicleUf ? { vehicleUf: draftExtra.vehicleUf } : {}),
        ...(draftExtra.volumesQty ? { volumesQty: parseDecimal(draftExtra.volumesQty) } : {}),
        ...(draftExtra.volumesSpecies ? { volumesSpecies: draftExtra.volumesSpecies } : {}),
        ...(draftExtra.volumesBrand ? { volumesBrand: draftExtra.volumesBrand } : {}),
        ...(draftExtra.weightNet ? { weightNet: parseDecimal(draftExtra.weightNet) } : {}),
        ...(draftExtra.weightGross ? { weightGross: parseDecimal(draftExtra.weightGross) } : {}),
        ...(draftExtra.freteValor ? { freteValor: parseDecimal(draftExtra.freteValor) } : {}),
        ...(draftExtra.cobrancaNumero ? { cobrancaNumero: draftExtra.cobrancaNumero } : {}),
        ...(draftExtra.cobrancaVencimento ? { cobrancaVencimento: draftExtra.cobrancaVencimento } : {}),
        ...(draftExtra.cobrancaValor ? { cobrancaValor: parseDecimal(draftExtra.cobrancaValor) } : {}),
        pagamentoTipo: draftExtra.pagamentoTipo,
        ...(draftExtra.informacoesAdicionais.trim()
          ? { informacoesAdicionais: draftExtra.informacoesAdicionais.trim() }
          : {}),
        ...(draftExtra.refNFe.trim() ? { refNFe: draftExtra.refNFe.trim() } : {}),
      })
      return res.data
    },
    onSuccess: (data: any) => {
      if (data?.status === 'authorized' || data?.cStat === 'SIMULADO') {
        setEmitSuccess({ nfeNum: data?.number })
        setTimeout(() => nav('/nfe-emit'), 3500)
      } else {
        const cStat = data?.cStat ?? '?'
        const xMotivo = data?.xMotivo ?? 'Rejeição sem motivo informado.'
        setEmitError(`SEFAZ [${cStat}]: ${xMotivo}`)
      }
    },
    onError: (err: any) => {
      const raw = err?.response?.data?.message ?? err?.message ?? 'Erro desconhecido'
      const msg = Array.isArray(raw) ? raw.join(' | ') : String(raw)
      // Torna mensagens técnicas mais amigáveis
      const friendly = msg
        .replace('tenantId e companyId são obrigatórios', 'Configuração de empresa não encontrada. Contate o suporte.')
        .replace('NF não está em draft', 'Esta NF já foi emitida ou cancelada — atualize a página.')
        .replace('NF draft sem itens', 'A NF não tem itens. Adicione ao menos um produto antes de emitir.')
        .replace('Falha na comunicação com SEFAZ', 'Falha na comunicação com a SEFAZ. Verifique a conexão com a internet e tente novamente.')
      setEmitError(friendly)
    },
  })

  const recipientName =
    nfe?.customer?.name ?? nfe?.supplier?.name ?? nfe?.destinatario ?? nfe?.receiver_name ?? '-'
  const recipientDoc = nfe?.customer?.document ?? nfe?.supplier?.document ?? null
  const recipientIe = nfe?.customer?.ie ?? nfe?.supplier?.ie ?? null
  const recipientAddress = nfe?.customer?.address ?? nfe?.supplier?.address ?? null
  const recipientCity = nfe?.customer?.municipio ?? nfe?.customer?.city ?? nfe?.supplier?.city ?? null
  const recipientUf = nfe?.customer?.state ?? nfe?.customer?.uf ?? nfe?.supplier?.state ?? nfe?.supplier?.uf ?? null
  const recipientEmail = nfe?.customer?.email ?? nfe?.supplier?.email ?? null
  const billingTerms = nfe?.customer?.billingTerms ?? null

  const totals = useMemo(() => {
    const items: any[] = nfe?.items ?? []
    const freteVal = parseDecimal(draftExtra.freteValor)

    // a57 — separar totais por CFOP: 5902 = produto físico; demais = serviço/insumo
    const lineTotal = (it: any) =>
      Number(it?.total ?? (Number(it?.qty ?? 0) * Number(it?.unitPrice ?? 0) - Number(it?.discount ?? 0)))

    const total5902 = items
      .filter((it: any) => String(it?.cfop) === '5902')
      .reduce((acc: number, it: any) => acc + lineTotal(it), 0)

    const totalServicosInsumos = items
      .filter((it: any) => String(it?.cfop) !== '5902')
      .reduce((acc: number, it: any) => acc + lineTotal(it), 0)

    const totalNF = total5902 + totalServicosInsumos + freteVal
    const qtd = sumQty(items)
    // Tributos aproximados IBPT — aplica-se apenas a itens faturáveis (exclui CFOP 5902)
    const IBPT_PCT = 31.45 // federal 13,45% + estadual 18,00%
    const tribApprox = totalServicosInsumos * IBPT_PCT / 100
    return { total5902, totalServicosInsumos, freteVal, totalNF, qtd, tribApprox }
  }, [nfe, draftExtra.freteValor])

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-600">Carregando rascunho…</div>
  }

  if (error || !nfe) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-red-600">Falha ao carregar o rascunho.</div>
        <button className="px-3 py-1 border rounded" onClick={() => refetch()}>Tentar novamente</button>
        <button className="px-3 py-1 border rounded" onClick={() => nav('/nfe-emit')}>Voltar</button>
      </div>
    )
  }

  const status = String(nfe?.status ?? 'draft')
  const isDraft = status === 'draft'

  const TABS = [
    { id: '1', label: 'Emitente / Destinatário' },
    { id: '2', label: 'Produtos' },
    { id: '3', label: 'Impostos / Totais' },
    { id: '4', label: 'Transporte' },
    { id: '5', label: 'Cobrança / Pagamento' },
  ]

  return (
    <>
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Finalizar e emitir NF-e</h1>
          {nfe.number ? (
            <p className="text-sm font-semibold text-tapajos-700 mt-0.5">
              NF-e Nº {String(nfe.number).padStart(9, '0')}
            </p>
          ) : nextNumData?.nextNumber ? (
            <p className="text-xs text-gray-500 mt-0.5" title="O número pode mudar se outra NF for emitida antes desta.">
              Próximo Nº previsto: <span className="font-mono">{String(nextNumData.nextNumber).padStart(9, '0')}</span>
            </p>
          ) : null}
          <p className="text-xs text-gray-400 mt-0.5">
            Criado em: {toPtDateTime(nfe.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="px-3 py-2 border rounded text-sm bg-white hover:bg-gray-50" onClick={() => nav('/nfe-emit')}>
            Voltar
          </button>
          <button
            className="px-3 py-2 border rounded text-sm bg-white hover:bg-gray-50"
            onClick={() => {
              const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
              window.open(`${base}/nfe-emit/${id}/danfe?tenantId=${tenantId}&companyId=${companyId}`, '_blank')
            }}
            title="Visualizar prévia do DANFE (rascunho, sem chave de acesso real)"
          >
            Ver prévia DANFE
          </button>
          <button
            disabled={!isDraft || emitMutation.isPending}
            className={`px-4 py-2 rounded text-sm font-medium ${
              isDraft
                ? 'bg-tapajos-600 text-white hover:bg-tapajos-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            onClick={() => emitMutation.mutate()}
            title={isDraft ? 'Emitir NF-e a partir do rascunho' : 'Apenas rascunhos podem ser emitidos'}
          >
            {emitMutation.isPending ? 'Emitindo…' : 'Emitir NF-e'}
          </button>
        </div>
      </div>

      {/* Sumário de revisão */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Resumo da NF a emitir</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Destinatário</span>
            <div className="font-medium text-gray-900 truncate">{recipientName}</div>
            <div className="text-xs text-gray-500">{recipientDoc ?? '—'}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Natureza da Operação</span>
            <div className="font-medium text-gray-900">{naturezaOperacao || <span className="text-red-500 italic">Não preenchida</span>}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Totais</span>
            <div className="font-semibold text-gray-900">NF: R$ {toPtMoney(totals.totalNF)}</div>
            <div className="text-xs text-gray-500">Prod: R$ {toPtMoney(totals.total5902)} · Serv: R$ {toPtMoney(totals.totalServicosInsumos)}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Prazo de cobrança</span>
            <div className="font-medium text-gray-900">
              {billingTerms ? (BILLING_TERMS_LABEL[billingTerms] ?? billingTerms) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1.5 border-b pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id as any)}
            className={`px-4 py-2 rounded-t text-sm font-medium border-b-2 transition-colors ${
              aba === t.id
                ? 'border-tapajos-600 text-tapajos-700 bg-tapajos-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ABA 1 — Emitente / Destinatário */}
      {aba === '1' && (
        <div className="space-y-5">

          {/* Natureza da Operação */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Natureza da Operação</h3>
            <Field label="Selecionar predefinido">
              <select
                className="border rounded px-3 py-2 text-sm w-full"
                value=""
                onChange={e => { if (e.target.value) setNaturezaOperacao(e.target.value) }}
              >
                <option value="">— Escolher —</option>
                <option value="Prestação de serviço de beneficiamento">Prestação de serviço de beneficiamento</option>
                <option value="Remessa para industrialização por encomenda">Remessa para industrialização por encomenda</option>
                <option value="Retorno de mercadoria remetida para industrialização">Retorno de mercadoria remetida para industrialização</option>
                <option value="Remessa grátis">Remessa grátis</option>
                <option value="Reprocesso">Reprocesso</option>
                <option value="Venda de mercadoria">Venda de mercadoria</option>
                <option value="Venda de produção do estabelecimento">Venda de produção do estabelecimento</option>
                <option value="Transferência de mercadoria">Transferência de mercadoria</option>
              </select>
            </Field>
            <Field label="Natureza da operação (texto que vai no XML)" required>
              <input
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="Ex.: Prestação de serviço de beneficiamento"
                value={naturezaOperacao}
                onChange={e => setNaturezaOperacao(e.target.value)}
              />
            </Field>
            <Field label="NF(s) do cliente referenciada — DEV (CFOP 5902)" hint="Uma por linha. Formato: número|MM/AAAA ou número|MM/AAAA|P (parcial). Ex.: 23778|10/2025 — aparece no DANFE como DEV. TOTAL DA SUA NF-E 23778 DE 10/2025. Para chave completa de 44 dígitos o NFref é também inserido no XML.">
              <textarea
                className="border rounded px-3 py-2 text-sm w-full font-mono text-xs"
                rows={3}
                placeholder={"23778|10/2025\n22109|02/2026|P"}
                value={draftExtra.refNFe ?? ''}
                onChange={e => setDraftExtra(prev => ({ ...prev, refNFe: e.target.value }))}
              />
            </Field>
          </div>

          {/* Emitente */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Emitente (Tapajós — auto-preenchido)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReadonlyField label="Razão Social" value={nfe?.company?.legalName} />
              <ReadonlyField label="Nome Fantasia" value={nfe?.company?.tradeName} />
              <ReadonlyField label="CNPJ" value={nfe?.company?.cnpj} />
              <ReadonlyField label="Inscrição Estadual (IE)" value={nfe?.company?.ie} />
              <ReadonlyField label="CRT" value={(nfe?.company as any)?.crt} />
              <ReadonlyField label="Alíq. crédito ICMS SN" value={(nfe?.company as any)?.icmsSnRate != null ? `${Number((nfe?.company as any).icmsSnRate).toFixed(2)}%` : null} />
              <ReadonlyField label="Endereço" value={[nfe?.company?.address, (nfe?.company as any)?.number, (nfe?.company as any)?.district, nfe?.company?.city, nfe?.company?.uf].filter(Boolean).join(', ') || null} />
              <ReadonlyField label="CEP / Telefone" value={[(nfe?.company as any)?.zip, nfe?.company?.phone].filter(Boolean).join(' — ') || null} />
            </div>
          </div>

          {/* Destinatário */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Destinatário</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReadonlyField label="Nome / Razão Social" value={recipientName} />
              <ReadonlyField label="CNPJ / CPF" value={recipientDoc} />
              <ReadonlyField label="Inscrição Estadual (IE)" value={recipientIe} />
              <ReadonlyField label="E-mail" value={recipientEmail} />
              <ReadonlyField label="Endereço" value={recipientAddress} />
              <div className="grid grid-cols-2 gap-3">
                <ReadonlyField label="Município" value={recipientCity} />
                <ReadonlyField label="UF" value={recipientUf} />
              </div>
              <ReadonlyField label="Telefone" value={nfe?.customer?.phone ?? nfe?.supplier?.phone ?? null} />
              <ReadonlyField label="Bairro / Distrito" value={nfe?.customer?.district ?? nfe?.supplier?.district ?? null} />
            </div>
            {billingTerms && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2 text-amber-800">
                <strong>Prazo de cobrança cadastrado:</strong> {BILLING_TERMS_LABEL[billingTerms] ?? billingTerms}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2 — Produtos */}
      {aba === '2' && (
        <div className="border rounded-lg overflow-auto">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <span className="font-semibold text-gray-800">Itens da NF-e</span>
            <span className="ml-3 text-sm text-gray-500">{(nfe?.items ?? []).length} item(ns)</span>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CFOP</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">NCM</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase" title="Código de Situação da Operação — Simples Nacional">CSOSN</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase" title="Código Especificador da Substituição Tributária">CEST</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Un</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">V. Unit (R$)</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(nfe?.items ?? []).map((it: any) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{it?.sku ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-900 font-medium">{it?.description ?? ''}</td>
                  <td className="px-4 py-2 text-gray-600">{it?.cfop ?? ''}</td>
                  <td className="px-4 py-2 text-gray-600">{it?.ncm ?? ''}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{(it?.taxes as any)?.csosn ?? it?.csosn ?? <span className="text-amber-500 italic">—</span>}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{(it?.taxes as any)?.cest ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{Number(it?.qty ?? 0).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{it?.unit ?? ''}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{toPtMoney(it?.unitPrice ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{toPtMoney(it?.total ?? 0)}</td>
                </tr>
              ))}
              {(nfe?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-400 italic">Nenhum item encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3 — Impostos / Totais */}
      {aba === '3' && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Totais da NF-e</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Produtos (CFOP 5902)</div>
                <div className="text-xl font-bold text-gray-900 mt-1">R$ {toPtMoney(totals.total5902)}</div>
              </div>
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Serviços e Insumos</div>
                <div className="text-xl font-bold text-gray-900 mt-1">R$ {toPtMoney(totals.totalServicosInsumos)}</div>
              </div>
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Frete emitente</div>
                <div className="text-xl font-bold text-gray-900 mt-1">R$ {toPtMoney(totals.freteVal)}</div>
              </div>
              <div className="bg-tapajos-50 border border-tapajos-200 rounded-lg p-3">
                <div className="text-xs text-tapajos-600 uppercase tracking-wide font-semibold">Total NF</div>
                <div className="text-xl font-bold text-tapajos-800 mt-1">R$ {toPtMoney(totals.totalNF)}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              <span className="font-medium">Quantidade total:</span>{' '}
              {Number(totals.qtd).toLocaleString('pt-BR')} unidades em {(nfe?.items ?? []).length} item(ns)
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-800 mb-2">Impostos por item</h3>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CFOP</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">NCM</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CSOSN</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase" title="Código Especificador da Substituição Tributária">CEST</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CST PIS</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CST COFINS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(nfe?.items ?? []).map((it: any) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{it?.description ?? ''}</td>
                    <td className="px-3 py-2 text-gray-600">{it?.cfop ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{it?.ncm ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{(it?.taxes as any)?.csosn ?? it?.csosn ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{(it?.taxes as any)?.cest ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{it?.cstPis ?? '08'}</td>
                    <td className="px-3 py-2 text-gray-600">{it?.cstCofins ?? '08'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <strong>Por que não há valores de imposto?</strong> A Tapajós é optante pelo Simples Nacional.
              No Simples, ICMS, PIS e COFINS são recolhidos mensalmente de forma unificada —
              não há destaque de valor nas NF-e (CSOSN 400 = sem destaque de ICMS).
              PIS/COFINS: CST 08 (operação sem incidência). Isso está correto fiscalmente.
            </div>
          </div>
        </div>
      )}

      {/* ABA 4 — Transporte */}
      {aba === '4' && (
        <div className="border rounded-lg p-4 space-y-5">
          <h3 className="font-semibold text-gray-800">Dados de Transporte</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Transportadora">
              <select
                className="border rounded px-3 py-2 text-sm w-full"
                value={transportadoraId}
                onChange={e => setTransportadoraId(e.target.value)}
              >
                <option value="">— Nenhuma / sem transportadora —</option>
                {transporters.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="CNPJ da Transportadora (auto-preenchido)">
              <input
                className="border rounded px-3 py-2 text-sm w-full bg-gray-50"
                value={transporters.find((t: any) => t.id === transportadoraId)?.cnpj ?? nfe?.cnpjTransportadora ?? ''}
                readOnly
                placeholder="Selecionada acima"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Tipo de frete" required hint="Define quem paga o frete: normalmente 'Por conta do destinatário' (padrão para beneficiamento)">
              <select
                className="border rounded px-3 py-2 text-sm w-full"
                value={draftExtra.freightType}
                disabled={fieldIsLocked(nfe?.freightType)}
                onChange={e => setDraftExtra(s => ({ ...s, freightType: e.target.value }))}
              >
                <option value="">Selecione…</option>
                <option value="destinatario">Por conta do destinatário (0)</option>
                <option value="remetente">Por conta do remetente (1)</option>
                <option value="terceiros">Por conta de terceiros (2)</option>
                <option value="semFrete">Sem frete (9)</option>
              </select>
              {fieldIsLocked(nfe?.freightType) && (
                <span className="text-xs text-gray-400">Vindo do rascunho — não editável</span>
              )}
            </Field>
            <Field label="Placa do veículo">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.vehiclePlate) ? 'bg-gray-50' : ''}`}
                placeholder="Ex.: ABC-1234"
                value={draftExtra.vehiclePlate}
                readOnly={fieldIsLocked(nfe?.vehiclePlate)}
                onChange={e => setDraftExtra(s => ({ ...s, vehiclePlate: e.target.value }))}
              />
            </Field>
            <Field label="UF da placa">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.vehicleUf) ? 'bg-gray-50' : ''}`}
                placeholder="Ex.: SP"
                value={draftExtra.vehicleUf}
                readOnly={fieldIsLocked(nfe?.vehicleUf)}
                onChange={e => setDraftExtra(s => ({ ...s, vehicleUf: e.target.value }))}
                maxLength={2}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Quantidade de volumes" hint="Número de volumes/embalagens expedidas (campo vol.qVol no XML)">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.volumesQty) ? 'bg-gray-50' : ''}`}
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 10"
                value={draftExtra.volumesQty}
                readOnly={fieldIsLocked(nfe?.volumesQty)}
                onChange={decimalOnChange(v => setDraftExtra(s => ({ ...s, volumesQty: v })))}
              />
            </Field>
            <Field label="Espécie dos volumes" hint="Tipo de embalagem: FARDOS, CAIXAS, SACOS, BOBINAS...">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.volumesSpecies) ? 'bg-gray-50' : ''}`}
                placeholder="Ex.: FARDOS, CAIXAS"
                value={draftExtra.volumesSpecies}
                readOnly={fieldIsLocked(nfe?.volumesSpecies)}
                onChange={e => setDraftExtra(s => ({ ...s, volumesSpecies: e.target.value }))}
              />
            </Field>
            <Field label="Marca dos volumes">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.volumesBrand) ? 'bg-gray-50' : ''}`}
                placeholder="Ex.: TAPAJÓS"
                value={draftExtra.volumesBrand}
                readOnly={fieldIsLocked(nfe?.volumesBrand)}
                onChange={e => setDraftExtra(s => ({ ...s, volumesBrand: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Peso líquido (kg)">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.weightNet) ? 'bg-gray-50' : ''}`}
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 125,500"
                value={draftExtra.weightNet}
                readOnly={fieldIsLocked(nfe?.weightNet)}
                onChange={decimalOnChange(v => setDraftExtra(s => ({ ...s, weightNet: v })))}
              />
            </Field>
            <Field label="Peso bruto (kg)">
              <input
                className={`border rounded px-3 py-2 text-sm w-full ${fieldIsLocked(nfe?.weightGross) ? 'bg-gray-50' : ''}`}
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 130,000"
                value={draftExtra.weightGross}
                readOnly={fieldIsLocked(nfe?.weightGross)}
                onChange={decimalOnChange(v => setDraftExtra(s => ({ ...s, weightGross: v })))}
              />
            </Field>
          </div>

          {/* a58 — Valor do frete cobrado */}
          <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Valor do Frete (a58)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Valor do frete cobrado (R$)" hint="Se o emitente cobra pelo frete, informe aqui. Será somado ao Total NF e à cobrança.">
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={draftExtra.freteValor}
                  onChange={decimalOnChange(v => setDraftExtra(s => ({ ...s, freteValor: v })))}
                />
              </Field>
              {totals.freteVal > 0 && (
                <div className="flex items-end">
                  <div className="bg-white border border-amber-300 rounded p-3 text-sm">
                    <span className="text-gray-500 block text-xs">Total NF com frete</span>
                    <span className="font-bold text-gray-900">R$ {toPtMoney(totals.totalNF)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 5 — Cobrança / Pagamento */}
      {aba === '5' && (
        <div className="space-y-5">

          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Duplicata / Fatura</h3>
              {billingTerms && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
                  Prazo do cliente: <strong>{BILLING_TERMS_LABEL[billingTerms] ?? billingTerms}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Número da duplicata" hint="Preenchido automaticamente com o número da NF. Pode ser ajustado.">
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="Ex.: 001"
                  value={draftExtra.cobrancaNumero}
                  onChange={e => setDraftExtra(s => ({ ...s, cobrancaNumero: e.target.value }))}
                />
              </Field>
              <Field label="Data de vencimento" hint="Calculada automaticamente pelo prazo de cobrança cadastrado no cliente.">
                <input
                  type="date"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={draftExtra.cobrancaVencimento}
                  onChange={e => setDraftExtra(s => ({ ...s, cobrancaVencimento: e.target.value }))}
                />
              </Field>
              <Field label="Valor da duplicata (R$)" hint="Deve corresponder ao total da NF-e.">
                <input
                  type="text"
                  inputMode="decimal"
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="Ex.: 1.250,00"
                  value={draftExtra.cobrancaValor}
                  onChange={decimalOnChange(v => setDraftExtra(s => ({ ...s, cobrancaValor: v })))}
                />
              </Field>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">Forma de Pagamento</h3>
            <Field label="Forma de pagamento" hint="A forma registrada no XML. O valor pago é calculado automaticamente pelo sistema.">
              <select
                className="border rounded px-3 py-2 text-sm w-full max-w-xs"
                value={draftExtra.pagamentoTipo}
                onChange={e => setDraftExtra(s => ({ ...s, pagamentoTipo: e.target.value }))}
              >
                <option value="01">Dinheiro</option>
                <option value="03">Cartão de Crédito</option>
                <option value="04">Cartão de Débito</option>
                <option value="15">Boleto Bancário</option>
                <option value="17">Transferência bancária / PIX</option>
                <option value="99">Outros</option>
              </select>
            </Field>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Informações Adicionais / Complementares</h3>
            <p className="text-xs text-gray-500">
              Texto que aparece no campo &lt;infCpl&gt; do XML e no rodapé do DANFE. Disclaimers do Simples Nacional são adicionados automaticamente.
            </p>
            <textarea
              className="border rounded px-3 py-2 text-sm w-full min-h-[100px]"
              placeholder="Informações adicionais ao fisco e ao destinatário…"
              value={draftExtra.informacoesAdicionais}
              onChange={e => setDraftExtra(s => ({ ...s, informacoesAdicionais: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Footer — totais + erro */}
      {/* Checklist pré-emissão */}
      {isDraft && (() => {
        const checks = [
          { ok: !!naturezaOperacao.trim(), label: 'Natureza da Operação preenchida' },
          { ok: !!(recipientName && recipientName !== '-'), label: 'Destinatário definido' },
          { ok: !!(recipientDoc), label: 'CNPJ/CPF do destinatário' },
          { ok: (nfe?.items ?? []).length > 0, label: `Itens na NF (${(nfe?.items ?? []).length})` },
          { ok: !!(nfe?.items ?? []).every((it: any) => it.cfop), label: 'CFOP preenchido em todos os itens' },
          { ok: !!(nfe?.items ?? []).every((it: any) => it.ncm), label: 'NCM preenchido em todos os itens' },
          { ok: !!draftExtra.cobrancaVencimento, label: 'Data de vencimento da duplicata' },
          { ok: parseDecimal(draftExtra.cobrancaValor) > 0, label: 'Valor da duplicata > 0' },
        ]
        const allOk = checks.every(c => c.ok)
        return (
          <div className={`border rounded-lg p-4 ${allOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className={`text-sm font-semibold mb-2 ${allOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {allOk ? '✓ Tudo pronto para emitir' : 'Verificar antes de emitir'}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {checks.map((c, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <span>{c.ok ? '✓' : '⚠'}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Footer totais + erro */}
      <div className="border rounded-lg px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-700 flex flex-wrap gap-4">
          <span><span className="text-gray-500">Itens:</span> <strong>{(nfe?.items ?? []).length}</strong></span>
          <span><span className="text-gray-500">Qtd total:</span> <strong>{Number(totals.qtd).toLocaleString('pt-BR')}</strong></span>
          <span><span className="text-gray-500">Total produtos:</span> <strong>R$ {toPtMoney(totals.total5902)}</strong></span>
          <span><span className="text-gray-500">Serv./Insumos:</span> <strong>R$ {toPtMoney(totals.totalServicosInsumos)}</strong></span>
          <span><span className="text-gray-500">Total NF:</span> <strong>R$ {toPtMoney(totals.totalNF)}</strong></span>
          {totals.tribApprox > 0 && (
            <span title="Trib. aprox.: Federal 13,45% + Estadual 18,00% sobre Serv./Insumos (exclui CFOP 5902)">
              <span className="text-gray-500">Trib. aprox.:</span> <strong className="text-slate-600">R$ {toPtMoney(totals.tribApprox)}</strong>
              <span className="text-xs text-gray-400 ml-1">(31,45% sobre serv./ins.)</span>
            </span>
          )}
        </div>
        {emitError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 max-w-lg">
            <strong>Erro ao emitir:</strong> {emitError}
          </div>
        )}
      </div>
    </div>

    {/* Overlay de sucesso na emissão */}
    {emitSuccess && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
            <svg className="w-9 h-9 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">NF-e emitida com sucesso!</h2>
            {emitSuccess.nfeNum && (
              <p className="text-sm text-gray-500 mt-1">Número: <strong className="text-gray-800">{String(emitSuccess.nfeNum).padStart(6, '0')}</strong></p>
            )}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 space-y-1 text-left">
            <p>✓ XML assinado e salvo.</p>
            <p>✓ DANFE e XML enviados ao cliente e ao escritório contábil.</p>
          </div>
          <p className="text-xs text-gray-400">Redirecionando em instantes…</p>
        </div>
      </div>
    )}
    </>
  )
}
