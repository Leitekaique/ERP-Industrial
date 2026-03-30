import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Protege todas as rotas filhas.
// Se o usuário não estiver autenticado, redireciona para /login.
// O "replace" evita que /login fique no histórico de navegação.

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
