import React from 'react'

export function NfePreview({ form, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-[600px] shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Pré-visualização da NF-e</h2>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto h-64 whitespace-pre-wrap">
          {`
<NFe>
  <emit>
    <xNome>${form.emitenteNome}</xNome>
    <CNPJ>${form.emitenteCNPJ}</CNPJ>
  </emit>
  <dest>
    <xNome>${form.destinatarioNome}</xNome>
    <CNPJ>${form.destinatarioCNPJ}</CNPJ>
  </dest>
  <total>
    <vNF>${form.valorTotal}</vNF>
  </total>
</NFe>
          `}
        </pre>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
