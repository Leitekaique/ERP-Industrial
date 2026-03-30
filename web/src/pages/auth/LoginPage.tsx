import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth, AuthUser } from '../../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await api.post('/auth/login', { email, password })
      const { accessToken, user } = res.data as { accessToken: string; user: AuthUser }
      login(accessToken, user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err?.message ?? 'Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-tapajos-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / Marca */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Tapajós</h1>
          <p className="text-tapajos-300 text-sm mt-1">Sistema de Gestão</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com.br"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tapajos-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tapajos-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-tapajos-700 hover:bg-tapajos-800 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
