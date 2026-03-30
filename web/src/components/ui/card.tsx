import { ReactNode } from 'react'

export function Card({ children }: { children: ReactNode }) {
  return <div className="border rounded-lg shadow p-4 bg-white">{children}</div>
}

export function CardHeader({ title, children }: { title?: string; children?: ReactNode }) {
  return <div className="border-b pb-2 mb-2 font-semibold">{title ?? children}</div>
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-medium">{children}</h3>
}
