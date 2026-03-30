// Cabeçalho padrão de página com título, subtítulo e ações opcionais
// Uso: <PageHeader title="Clientes" sub="Cadastro de clientes">
//        <button>Nova ação</button>
//      </PageHeader>

import { type ReactNode } from 'react'

export function PageHeader({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
