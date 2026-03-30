// Estado vazio para tabelas e listas
// Uso: <EmptyState message="Nenhum cliente cadastrado" />

export function EmptyState({
  message,
  colSpan = 5,
}: {
  message: string
  colSpan?: number
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-gray-400 text-sm">
        {message}
      </td>
    </tr>
  )
}

// Versão standalone (fora de tabela)
export function EmptyBox({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm border rounded-lg bg-gray-50">
      {message}
    </div>
  )
}
