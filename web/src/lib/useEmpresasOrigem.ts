import { useQuery } from '@tanstack/react-query'
import { useApi } from './useApi'

export function useEmpresasOrigem(params: {
  tenantId: string
  companyId: string
}) {
  const api = useApi()

  return useQuery({
    queryKey: ['empresas-origem', params],
    enabled: !!params?.tenantId && !!params?.companyId,
    queryFn: async () => {
    const res = await api.get('/empresas-origem', { params })
    return Array.isArray(res) ? res : []
    },
  })
}
