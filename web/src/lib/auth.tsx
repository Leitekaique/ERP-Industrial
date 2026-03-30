import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
  tenantId: string
  companyId: string
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
// Envolve toda a aplicação e mantém o estado de autenticação.
// Persiste token e usuário no localStorage para sobreviver a recarregamentos.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('erp_token')
  )
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('erp_user')
    return raw ? JSON.parse(raw) : null
  })

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('erp_token', newToken)
    localStorage.setItem('erp_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Uso: const { user, logout, isAuthenticated } = useAuth()

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
