import React, { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'

interface Cenario {
  id: string
  titulo: string
  cfops: string[]
  tipo: 'servico' | 'venda' | 'retorno' | 'entrada'
  descricao: string
  passos: string[]
  verificar: string[]
  xmlEsperado?: string
}

const CENARIOS: Cenario[] = [
  {
    id: 'svc-regular',
    titulo: 'Serviço de beneficiamento — operação regular',
    cfops: ['5124', '5902'],
    tipo: 'servico',
    descricao: 'Cliente envia tecido diretamente para Tapajós. Tapajós processa e emite NF de serviço (MO) + retorno simbólico do tecido.',
    passos: [
      'Importar NF de remessa do cliente (natOp: REMESSA INDUSTRIALIZAÇÃO / CFOP 5901)',
      'Verificar lote criado no estoque com customerId = cliente',
      'Selecionar lote(s) no estoque → "Emitir NF dos selecionados"',
      'Conferir destinatário = cliente, CFOP 5124 (MO) + 5902 (tecido)',
      'Preencher data de vencimento e emitir',
    ],
    verificar: [
      'XML: cBenef = SP054020 em todos os itens',
      'XML: CSOSN = 400 / ICMSSN102 (sem crédito)',
      'XML: infCpl contém "ICMS SUSPENSO - ART. 402 DO RICMS/SP"',
      'XML: cobr com duplicata no vencimento informado',
      'DANFE: campo CSOSN "400" nas linhas de produto',
      'SEFAZ: cStat = 100 (autorizada)',
    ],
  },
  {
    id: 'svc-triangulacao',
    titulo: 'Serviço em triangulação',
    cfops: ['5125', '5925'],
    tipo: 'servico',
    descricao: 'Fornecedor do cliente entrega diretamente para Tapajós (NF de venda para o cliente, mas com entrega em Tapajós). Tapajós emite NF de serviço para o cliente contratante.',
    passos: [
      'Importar NF do fornecedor (CFOP 5924 ou natOp contendo "TRIANGULAÇÃO" / "CONTA E ORDEM")',
      'Verificar: customer = cliente contratante (dest da NF), supplier = fornecedor (emit)',
      'Verificar lote de estoque criado com processo = Industrializacao',
      'Verificar produto MO criado com CFOP 5125',
      'Selecionar lote → "Emitir NF dos selecionados"',
      'Conferir destinatário = cliente contratante, CFOP 5125 + 5925',
    ],
    verificar: [
      'XML: cBenef = SP054020 em todos os itens',
      'XML: CSOSN = 400 / ICMSSN102',
      'XML: infCpl "ICMS SUSPENSO - ART. 402 DO RICMS/SP"',
      'DANFE: destinatário = cliente contratante (não o fornecedor)',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'venda-direta',
    titulo: 'Venda direta de produto',
    cfops: ['5101'],
    tipo: 'venda',
    descricao: 'Tapajós vende produto de sua produção diretamente a um cliente. Único caso com crédito de ICMS (CSOSN 101).',
    passos: [
      'Criar NF manual (NfeForm) com CFOP 5101',
      'Selecionar cliente destinatário',
      'Preencher produto, NCM, quantidade, valor',
      'Emitir',
    ],
    verificar: [
      'XML: CSOSN = 101 / ICMSSN101 com pCredSN e vCredICMSSN',
      'XML: SEM cBenef (sem suspensão para vendas diretas)',
      'XML: cobr com duplicata',
      'DANFE: alíquota de crédito visível',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'retorno-conserto',
    titulo: 'Retorno de material enviado para conserto',
    cfops: ['5916'],
    tipo: 'retorno',
    descricao: 'Tapajós devolve material ao cliente após conserto/reparo.',
    passos: [
      'Criar NF manual com CFOP 5916',
      'Selecionar cliente destinatário',
      'Itens = material devolvido (sem valor de cobrança)',
    ],
    verificar: [
      'XML: CSOSN = 400 / ICMSSN102',
      'XML: cBenef = SP054020',
      'XML: pagamento tipo 99 (sem pagamento) ou valor zero',
      'DANFE: sem seção de cobrança',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'outras-saidas',
    titulo: 'Outras saídas / devoluções diversas',
    cfops: ['5949'],
    tipo: 'retorno',
    descricao: 'Saídas diversas que não se encaixam nos CFOPs padrão (ex: remessa de amostra, devolução parcial).',
    passos: [
      'Criar NF manual com CFOP 5949',
      'Preencher natureza da operação descritiva',
      'Emitir sem seção de cobrança',
    ],
    verificar: [
      'XML: CSOSN = 400 / ICMSSN102',
      'XML: pagamento tipo 99 (sem pagamento)',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'entrada-2949',
    titulo: 'NF de entrada — retorno de material (CFOP 2949)',
    cfops: ['2949'],
    tipo: 'entrada',
    descricao: 'Tapajós emite NF de entrada para registrar retorno de material emitido incorretamente. tpNF = 0.',
    passos: [
      'Criar NF manual com CFOP 2949',
      'Selecionar cliente/fornecedor como destinatário',
      'Preencher produtos e valores (sem cobrança)',
      'Emitir',
    ],
    verificar: [
      'XML: tpNF = 0 (entrada)',
      'XML: pagamento tipo 99 / descrição "SEM PAGAMENTO"',
      'XML: sem seção cobr',
      'DANFE: "Entrada" visível no campo de indicação',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'interestadual',
    titulo: 'Operação interestadual (CFOPs 6xxx)',
    cfops: ['6124', '6902', '6125', '6925'],
    tipo: 'servico',
    descricao: 'Mesmos fluxos dos CFOPs 5xxx, mas para destinatários fora de SP. idDest = 2 no XML.',
    passos: [
      'Qualquer dos fluxos acima, mas com cliente de outro estado',
      'Verificar UF do destinatário diferente de SP',
    ],
    verificar: [
      'XML: idDest = 2 (interestadual)',
      'XML: cBenef = SP054020 (mesmo para interestadual — Art. 402 não distingue)',
      'XML: CSOSN = 400 / ICMSSN102',
      'SEFAZ: cStat = 100',
    ],
  },
  {
    id: 'cce',
    titulo: 'Carta de Correção Eletrônica (CC-e)',
    cfops: [],
    tipo: 'servico',
    descricao: 'Correção de dados da NF-e após autorização (exceto valor, destinatário, itens). Versão = 1.00.',
    passos: [
      'Na lista de NF-e, clicar em "CC-e" na NF autorizada',
      'Preencher texto de correção (mínimo 15 chars)',
      'Confirmar envio',
    ],
    verificar: [
      'XML evento: verEvento = 1.00, detEvento versao = 1.00',
      'XML evento: xCondUso contém "paragrafo 1o-A do art. 7o"',
      'SEFAZ: cStat = 135 (evento vinculado com sucesso)',
    ],
  },
  {
    id: 'cancelamento',
    titulo: 'Cancelamento de NF-e',
    cfops: [],
    tipo: 'servico',
    descricao: 'Cancelamento de NF-e dentro do prazo (até 24h da autorização).',
    passos: [
      'Na lista de NF-e, clicar em "Cancelar" na NF autorizada',
      'Informar justificativa (mínimo 15 chars)',
      'Confirmar cancelamento',
    ],
    verificar: [
      'SEFAZ: cStat = 101 (cancelamento homologado)',
      'NF marcada como cancelada na lista',
    ],
  },
]

const TIPO_CORES: Record<string, string> = {
  servico: 'bg-blue-100 text-blue-700',
  venda: 'bg-green-100 text-green-700',
  retorno: 'bg-amber-100 text-amber-700',
  entrada: 'bg-purple-100 text-purple-700',
}

const TIPO_LABEL: Record<string, string> = {
  servico: 'Serviço',
  venda: 'Venda',
  retorno: 'Retorno',
  entrada: 'Entrada',
}

export default function QaEmissaoPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }))

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const totalChecks = CENARIOS.reduce((acc, c) => acc + c.verificar.length, 0)
  const doneChecks = Object.values(checkedItems).filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader title="QA — Emissão de NF-e" sub="Checklist de cenários por CFOP. Marque cada item após verificar.">
        <span className="text-sm text-slate-500">
          {doneChecks} / {totalChecks} verificações concluídas
        </span>
        <button
          className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50 text-slate-600"
          onClick={() => setCheckedItems({})}
        >
          Limpar marcações
        </button>
      </PageHeader>

      <div className="space-y-3">
        {CENARIOS.map(c => {
          const isOpen = expanded[c.id] ?? false
          const cenarioChecks = c.verificar.map((_, i) => `${c.id}__v${i}`)
          const done = cenarioChecks.filter(k => checkedItems[k]).length
          const allDone = done === c.verificar.length

          return (
            <div key={c.id} className={`border rounded-lg overflow-hidden ${allDone ? 'border-green-200' : 'border-slate-200'}`}>
              <button
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3 text-left ${allDone ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}
                onClick={() => toggleExpand(c.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPO_CORES[c.tipo]}`}>
                    {TIPO_LABEL[c.tipo]}
                  </span>
                  <span className="font-medium text-slate-800">{c.titulo}</span>
                  {c.cfops.length > 0 && (
                    <span className="text-xs text-slate-400 font-mono">
                      {c.cfops.join(' · ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${allDone ? 'text-green-600 font-semibold' : 'text-slate-400'}`}>
                    {done}/{c.verificar.length}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="border-t px-4 py-4 space-y-4 bg-white">
                  <p className="text-sm text-slate-600">{c.descricao}</p>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Passos para reproduzir</h4>
                    <ol className="space-y-1">
                      {c.passos.map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-700">
                          <span className="text-slate-400 shrink-0">{i + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">O que verificar</h4>
                    <ul className="space-y-2">
                      {c.verificar.map((v, i) => {
                        const key = `${c.id}__v${i}`
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              id={key}
                              checked={!!checkedItems[key]}
                              onChange={() => toggle(key)}
                              className="mt-0.5 accent-tapajos-600"
                            />
                            <label
                              htmlFor={key}
                              className={`text-sm cursor-pointer select-none ${checkedItems[key] ? 'line-through text-slate-400' : 'text-slate-700'}`}
                            >
                              {v}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
