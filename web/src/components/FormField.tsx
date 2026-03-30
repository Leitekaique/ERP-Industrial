import { ReactNode } from 'react'

export function FormField({
  label,
  required,
  children,
  title,
  hint,
}: {
  label: string
  required?: boolean
  children: ReactNode
  title?: string
  hint?: string
}) {
  return (
    <label className="block mb-3" title={title}>
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>}
    </label>
  )
}
