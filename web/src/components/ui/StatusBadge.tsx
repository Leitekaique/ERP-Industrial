type StatusConfig = {
  label: string
  className: string
}

export const RECEIVABLE_STATUS: Record<string, StatusConfig> = {
  open:     { label: 'Em aberto', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
  partial:  { label: 'Parcial',   className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' },
  paid:     { label: 'Pago',      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  canceled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20' },
}

export const PAYABLE_STATUS: Record<string, StatusConfig> = {
  open:     { label: 'Em aberto', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
  partial:  { label: 'Parcial',   className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' },
  paid:     { label: 'Pago',      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  canceled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20' },
}

export const BILLING_STATUS: Record<string, StatusConfig> = {
  open:    { label: 'Em aberto', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
  sent:    { label: 'Enviado',   className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' },
  paid:    { label: 'Pago',      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  overdue: { label: 'Vencido',   className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
}

export const NFE_STATUS: Record<string, StatusConfig> = {
  draft:      { label: 'Rascunho',   className: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20' },
  authorized: { label: 'Autorizada', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
  canceled:   { label: 'Cancelada',  className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
  error:      { label: 'Erro',       className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
  rejected:   { label: 'Rejeitada',  className: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' },
}

export function StatusBadge({
  status,
  map,
}: {
  status: string
  map: Record<string, StatusConfig>
}) {
  const cfg = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
