import { useApi } from './useApi'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'


export function useProcesses(params: {
	tenantId: string
	companyId: string
	search?: string
	active?: boolean
}) {
  const api = useApi()

  return useQuery({
    queryKey: ['processes', params],
    queryFn: async () => {
	return await api.get('/processes', { params })
    },
  })
}
export function useProcess(id?: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['process', id],
    enabled: !!id,
    queryFn: async () => {
      return await api.get(`/processes/${id}`)
    },
  })
}
export function useProcessesLite(params: {
  tenantId: string
  companyId: string
  empresaId?: string
}) {
  const api = useApi()
  return useQuery({
    queryKey: ['processes-lite', params],
    enabled: !!params.empresaId,
    queryFn: async () => {
      const res = await api.get('/processes', { params: {
          tenantId: params.tenantId,
          companyId: params.companyId,
        },
      })
	  const data = Array.isArray(res) ? res : []
      if (!params.empresaId) return []
      return data.filter((p: any) =>
        params.empresaId === params.companyId
          ? !p.customerId
          : p.customerId === params.empresaId
      )
    },
  })
}
export function useCreateProcess() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => api.post('/processes', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes'] })
    },
  })
}

export function useUpdateProcess() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: any) =>
      api.patch(`/processes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes'] })
      qc.invalidateQueries({ queryKey: ['process'] })
    },
  })
}
export function useDeleteProcess() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/processes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes'] })
    },
  })
}
