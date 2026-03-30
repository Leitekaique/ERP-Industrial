import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStockBalance, useNfePreviewFromStock } from '../../lib/useApi'
import { ConvertUnitModal } from '../../components/ConvertUnitModal'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { useQueryClient } from '@tanstack/react-query'

type GroupMode = 'empresa' | 'empresa_processo' | 'empresa_nf'

function IndeterminateCheckbox(props: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  onClick?: (e: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.indeterminate = props.indeterminate && !props.checked
  }, [props.indeterminate, props.checked])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={props.checked}
      onChange={props.onChange}
      onClick={props.onClick}
    />
  )
}

function computeCheckState(childIds: string[], selected: Record<string, boolean>) {
  if (!childIds.length) return { checked: false, indeterminate: false }
  const selectedCount = childIds.reduce((acc, id) => acc + (selected[id] ? 1 : 0), 0)
  return {
    checked: selectedCount === childIds.length,
    indeterminate: selectedCount > 0 && selectedCount < childIds.length,
  }
}

export default function StockPage() {
  const { data = [], isLoading } = useStockBalance({})
  const queryClient = useQueryClient()

  const [groupMode, setGroupMode] = useState<GroupMode>('empresa')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [convertItem, setConvertItem] = useState<any | null>(null)
  const [expandedEmpresas, setExpandedEmpresas] = useState<Record<string, boolean>>({})
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const preview = useNfePreviewFromStock()
  const nav = useNavigate()

  const toggleEmpresa = (empresa: string) => {
    setExpandedEmpresas(prev => ({ ...prev, [empresa]: !prev[empresa] }))
  }

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => ({ ...prev, [key]: prev[key] === false ? true : false }))
  }

  const toggleSelect = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }))

  const setGroupSelection = (childIds: string[], nextValue: boolean) => {
    setSelected(prev => {
      const copy = { ...prev }
      childIds.forEach(id => {
        copy[id] = nextValue
      })
      return copy
    })
  }

  const hasSelected = useMemo(() => Object.values(selected).some(Boolean), [selected])

  const rows = useMemo(() => {
    if (!data.length) return []

    const q = search.trim().toLowerCase()
    const baseData = q
      ? data.filter((item: any) =>
          [item.ownerLabel, item.productName, item.sku, item.processo, item.reference,
           item.unit, String(item.onHand ?? ''), item.eventType]
            .some(v => String(v ?? '').toLowerCase().includes(q))
        )
      : data

    const result: any[] = []
    const byEmpresa: Record<string, any[]> = {}

    baseData.forEach((item: any) => {
      const empresa = item.ownerLabel ?? 'Empresa'
      if (!byEmpresa[empresa]) byEmpresa[empresa] = []
      byEmpresa[empresa].push(item)
    })

    Object.entries(byEmpresa).forEach(([empresa, items]) => {
      const isExpanded = expandedEmpresas[empresa] ?? true
      const empresaChildIds = items.map(i => i.id)
      const totalQtdEmpresa = items.reduce((acc, i) => acc + Number(i.onHand ?? 0), 0)

      result.push({
        __group: true,
        level: 'empresa',
        empresa,
        count: items.length,
        totalQtd: totalQtdEmpresa,
        expanded: isExpanded,
        childIds: empresaChildIds,
      })

      if (!isExpanded) return

      if (groupMode === 'empresa') {
        items.forEach(i => result.push(i))
        return
      }

      const key = groupMode === 'empresa_processo' ? 'processo' : 'reference'
      const grouped: Record<string, any[]> = {}

      items.forEach(i => {
        const k = i[key] || '—'
        if (!grouped[k]) grouped[k] = []
        grouped[k].push(i)
      })

      Object.entries(grouped).forEach(([label, subItems]) => {
        const subKey = `${empresa}__${label}`
        const isSubExpanded = expandedSubs[subKey] !== false // default expandido
        const totalQtdSub = subItems.reduce((acc, i) => acc + Number(i.onHand ?? 0), 0)
        result.push({
          __group: true,
          level: 'sub',
          label: groupMode === 'empresa_processo' ? `Processo: ${label}` : `NF: ${label}`,
          groupKey: label,
          subKey,
          expanded: isSubExpanded,
          totalQtd: totalQtdSub,
          childIds: subItems.map(s => s.id),
          groupType: groupMode === 'empresa_processo' ? 'processo' : 'nf',
        })
        if (isSubExpanded) {
          subItems.forEach(i => result.push(i))
        }
      })
    })

    return result
  }, [data, groupMode, expandedEmpresas, expandedSubs, search])

	const selectedLotIds = useMemo(
	  () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
	  [selected],
	)

	const onEmitSelected = async () => {
	  if (!selectedLotIds.length) return

	  const res = await preview.mutateAsync({
		tenantId: 'T-001',
		companyId: 'C-001',
		stockLotIds: selectedLotIds,
	  })

	  nav('/nfe/emit/from-stock', {
		state: {
		  preview: res,
		  stockLotIds: selectedLotIds,
		  tenantId: 'T-001',
		  companyId: 'C-001',
		},
	  })
	}

  return (
    <div className="space-y-4">
      <PageHeader title="Estoque" sub="Clique nos cabeçalhos Processo / NF Entrada para alternar agrupamento">
        <input
          type="text"
          className="border rounded px-3 py-2 text-sm w-52"
          placeholder="Buscar…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          disabled={!hasSelected || preview.isPending}
          className={`px-3 py-2 rounded text-sm ${
            hasSelected
              ? 'bg-tapajos-600 text-white hover:bg-tapajos-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          onClick={onEmitSelected}
        >
          {preview.isPending ? 'Carregando...' : 'Emitir NF dos selecionados'}
        </button>
        <button
          className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50"
          onClick={() => nav('/inventory/stock/history')}
        >
          Histórico
        </button>
        <button
          className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50"
          onClick={() => nav('/inventory/stock/move/new')}
        >
          Movimentar
        </button>
      </PageHeader>

      {/* TABELA */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-3 w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto</th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => setGroupMode(groupMode === 'empresa_processo' ? 'empresa' : 'empresa_processo')}
                title="Agrupar por processo"
              >
                Processo {groupMode === 'empresa_processo' ? '↑' : ''}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => setGroupMode(groupMode === 'empresa_nf' ? 'empresa' : 'empresa_nf')}
                title="Agrupar por NF"
              >
                NF Entrada {groupMode === 'empresa_nf' ? '↑' : ''}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Un.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Evento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Evento</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-[220px]">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                  Carregando…
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row, idx) => {
                // =========================
                // GRUPO: EMPRESA
                // =========================
                if (row.__group && row.level === 'empresa') {
                  const childIds: string[] = row.childIds ?? []
                  const st = computeCheckState(childIds, selected)

                  return (
                    <tr
                      key={`g_${idx}`}
                      className="bg-slate-100 cursor-pointer"
                      onClick={() => toggleEmpresa(row.empresa)}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <IndeterminateCheckbox
                          checked={st.checked}
                          indeterminate={st.indeterminate}
                          onChange={() => setGroupSelection(childIds, !(st.checked && !st.indeterminate))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <span>{row.expanded ? '▼' : '▶'}</span>
                            <span>{row.empresa}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>{row.count} item(ns)</span>
                            <span className="font-semibold text-slate-600">Total: {Number(row.totalQtd).toFixed(2)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // =========================
                // GRUPO: SUB (PROCESSO / NF)
                // =========================
                if (row.__group && row.level === 'sub') {
                  const childIds: string[] = row.childIds ?? []
                  const st = computeCheckState(childIds, selected)

                  return (
                    <tr
                      key={`s_${idx}`}
                      className="bg-slate-50 cursor-pointer"
                      onClick={() => toggleSub(row.subKey)}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <IndeterminateCheckbox
                          checked={st.checked}
                          indeterminate={st.indeterminate}
                          onChange={() => setGroupSelection(childIds, !(st.checked && !st.indeterminate))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td colSpan={9} className="px-4 py-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 font-medium text-slate-600 pl-4">
                            <span className="text-slate-400">{row.expanded ? '▼' : '▶'}</span>
                            <span>{row.label}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>{childIds.length} item(ns)</span>
                            <span className="font-semibold text-slate-600">Total: {Number(row.totalQtd).toFixed(2)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // =========================
                // LINHA NORMAL
                // =========================
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>

                    <td className="px-4 py-3 pl-8">
                      <div className="font-medium text-slate-900">{row.sku}</div>
                      <div className="text-xs text-slate-400">{row.productName}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-500">{row.processo}</td>
                    <td className="px-4 py-3 text-slate-500">{row.reference ?? '-'}</td>

                    <td className="px-4 py-3 text-slate-500">
                      {row.dataNF ? new Date(row.dataNF).toLocaleDateString('pt-BR') : '-'}
                    </td>

                    <td className="px-4 py-3 text-center text-slate-500">{row.unit}</td>

                    <td className="px-4 py-3 text-right text-slate-900 font-semibold">{Number(row.onHand).toFixed(2)}</td>

                    <td className="px-4 py-3 text-slate-500">{row.evento ?? '-'}</td>

                    <td className="px-4 py-3 text-slate-500">
                      {row.dataEvento ? new Date(row.dataEvento).toLocaleDateString('pt-BR') : '-'}
                    </td>

                    {/* ✅ AÇÕES (menores / centralizadas / cores suaves) */}
                    <td className="p-2">
                      <div className="flex items-center justify-center">
                        <div className="grid grid-cols-1 gap-1 w-full max-w-[170px]">
                          <button
                            className="px-2 py-1 rounded border text-xs bg-slate-50 hover:bg-slate-100 text-slate-700"
                            onClick={() =>
                              setConvertItem({
                                tenantId: 'T-001',
                                companyId: 'C-001',
                                ...row,
                                mode: 'convert',
                              })
                            }
                          >
                            Converter
                          </button>

                          <button
                            className="px-2 py-1 rounded border text-xs bg-blue-50 hover:bg-blue-100 text-blue-700"
                            onClick={() =>
                              nav(`/inventory/stock/move/${row.productId}`, {
                                state: {
                                  unit: row.unit,
                                  empresaOrigemId: row.empresaId,
                                },
                              })
                            }
                          >
                            Movimentar
                          </button>

                          <button
                            className="px-2 py-1 rounded border text-xs bg-amber-50 hover:bg-amber-100 text-amber-800"
                            onClick={() => nav(`/inventory/stock/${row.productId}/history`)}
                          >
                            Histórico
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {convertItem && (
        <ConvertUnitModal
          data={convertItem}
          onClose={() => setConvertItem(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['stock-balance'] })}
        />
      )}
    </div>
  )
}
