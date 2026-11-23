import React, { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  className?: string
  disabled?: boolean
  /** Prefix items shown before the sorted list (e.g. "O Próprio") */
  pinnedOptions?: SelectOption[]
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '— Selecione —',
  emptyLabel,
  className = '',
  disabled = false,
  pinnedOptions = [],
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected =
    pinnedOptions.find(o => o.value === value) ??
    options.find(o => o.value === value)

  const q = search.toLowerCase()
  const filtered = options
    .filter(o =>
      !q ||
      o.label.toLowerCase().includes(q) ||
      (o.sublabel ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full border rounded px-3 py-2 text-sm text-left bg-white flex items-center justify-between gap-2 disabled:bg-gray-50 disabled:text-gray-400 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-tapajos-500"
      >
        <span className={selected ? 'text-gray-900 truncate' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-tapajos-500"
              placeholder="Filtrar…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setSearch('') }
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].value)
              }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {/* Opção vazia */}
            {emptyLabel !== undefined && (
              <li
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${value === '' ? 'text-gray-400' : 'text-gray-500'}`}
                onClick={() => handleSelect('')}
              >
                {emptyLabel}
              </li>
            )}

            {/* Opções fixadas no topo (ex: "O Próprio") */}
            {pinnedOptions.length > 0 && (
              <>
                {pinnedOptions.map(o => (
                  <li
                    key={o.value}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    onClick={() => handleSelect(o.value)}
                  >
                    <div>{o.label}</div>
                    {o.sublabel && <div className="text-xs text-gray-400">{o.sublabel}</div>}
                  </li>
                ))}
                {options.length > 0 && <li className="border-t my-1" />}
              </>
            )}

            {/* Lista filtrada e ordenada */}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</li>
            ) : (
              filtered.map(o => (
                <li
                  key={o.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  onClick={() => handleSelect(o.value)}
                >
                  <div>{o.label}</div>
                  {o.sublabel && <div className="text-xs text-gray-400">{o.sublabel}</div>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
