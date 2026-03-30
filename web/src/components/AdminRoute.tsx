import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Protege rotas exclusivas de ADMIN.
// MANAGER é redirecionado para o dashboard.

export default function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
