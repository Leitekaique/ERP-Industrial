import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, TENANT_ID, COMPANY_ID, Product, Warehouse, Supplier, Payable, Customer, Receivable } from './api'
import axios from 'axios'


export { useEmpresasOrigem } from './useEmpresasOrigem'


// ============================================================
// 🧩 PRODUCTS
// ============================================================

export function useProducts(q?: string) {
  return useQuery({
    queryKey: ['products', q],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { q },
      })
      return Array.isArray(res.data) ? res.data : []
    },
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { sku: string; name: string; unit?: string; price: number; ncm?: string; cfop?: string }) => {
      const res = await api.post<Product>('/products', input)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await api.get<Product>(`/products/${id}`)).data,
    enabled: !!id,
  })
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Product>) => {
      const res = await api.patch<Product>(`/products/${id}`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
// ============================================================
// 🧩 WAREHOUSES
// ============================================================

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get<Warehouse[]>('/inventory/stock/warehouses')).data,
  })
}

export function useCreateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      const res = await api.post<Warehouse>('/inventory/stock/warehouses', input)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  })
}

// ============================================================
// 🧩 INVENTORY / STOCK
// ============================================================

export function useStockBalance(params: {
  warehouseId?: string
  sku?: string
  productId?: string
  ownership?: 'own' | 'third_party_in' | 'third_party_out'
  supplierId?: string
  customerId?: string
}) {
  const qs = new URLSearchParams({
    ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
    ...(params.productId ? { productId: params.productId } : {}),
    ...(params.sku ? { sku: params.sku } : {}),
    ...(params.ownership ? { ownership: params.ownership } : {}),
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
  })

  return useQuery({
    queryKey: ['stock-balance', params],
    queryFn: async () => (await api.get(`/inventory/stock/balance?${qs.toString()}`)).data,
  })
}

export function useStockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { warehouseId: string; productId: string; quantity: number; note?: string }) => {
      const { data } = await api.post('/inventory/stock/in', p)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-balance'] }),
  })
}

export function useStockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { warehouseId: string; productId: string; quantity: number; note?: string }) => {
      const { data } = await api.post('/inventory/stock/out', p)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-balance'] }),
  })
}

export function useStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { fromWarehouseId: string; toWarehouseId: string; productId: string; quantity: number; note?: string }) => {
      const { data } = await api.post('/inventory/stock/transfer', p)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-balance'] }),
  })
}

export function useStockHistoryList() {
  return useQuery({
    queryKey: ['stock-history-list'],
    queryFn: async () => {
      const res = await api.get('/inventory/stock/history', {
        params: { tenantId: 'T-001', companyId: 'C-001' },
      })
      return res.data
    },
  })
}

export function useStockHistoryItem(params: { productId: string }) {
  return useQuery({
    queryKey: ['stock-history-item', params.productId],
    queryFn: async () => {
      const res = await api.get(`/inventory/stock/${params.productId}/history`, {
        params: { tenantId: 'T-001', companyId: 'C-001' },
      })
      return res.data
    },
    enabled: !!params.productId,
  })
}

// ============================================================
// 🧩 SUPPLIERS
// ============================================================

export function useSuppliers(q?: string) {
  return useQuery({
    queryKey: ['suppliers', q],
    queryFn: async () => {
		const res = await api.get('/suppliers', { 
		  params: { q } 
		})
		return Array.isArray(res.data) ? res.data : []
	},
  })
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ['supplier', id],
	enabled: !!id,
    queryFn: async () => {
		const res = await api.get(`/suppliers/${id}`, {
				params: {
					tenantId: TENANT_ID,
					companyId: COMPANY_ID,
				},
			})
			return res.data
		},
	})
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/suppliers', {
		tenantId: TENANT_ID,
		companyId: COMPANY_ID,
		...data,
	}),
    onSuccess: () => {
		qc.invalidateQueries({ queryKey: ['suppliers'] })
	},
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: any ) =>
      api.patch<Supplier>(`/suppliers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['supplier'] })
    },
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({id, data}: any) => 
		api.delete(`/suppliers/${id}`, data),
    onSuccess: () => 
		qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

// ============================================================
// 🧩 PAYABLES
// ============================================================

export function usePayables(params: {
  status?: 'open' | 'paid' | 'canceled'
  supplierId?: string
  from?: string
  to?: string
  q?: string
  category?: string
}) {
  return useQuery({
    queryKey: ['payables', params],
    queryFn: async () => (await api.get<Payable[]>('/payables', { params })).data,
  })
}

export function useCreatePayable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { supplierId: string; dueDate: string; amount: number; paymentMethod: string; nfeReceivedId?: string }) => {
      const res = await api.post<Payable>('/payables', input)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  })
}

export function usePayableCategories() {
  return useQuery({
    queryKey: ['payable-categories'],
    queryFn: async () => (await api.get<string[]>('/payables/meta/categories', { params: { companyId: COMPANY_ID } })).data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAddPayableCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<string[]>('/payables/meta/categories', { name }, { params: { companyId: COMPANY_ID } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payable-categories'] }),
  })
}

export function useRemovePayableCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.delete<string[]>(`/payables/meta/categories/${encodeURIComponent(name)}`, { params: { companyId: COMPANY_ID } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payable-categories'] }),
  })
}

export function usePayable(id?: string) {
  return useQuery({
    queryKey: ['payable', id],
    queryFn: async () => (await api.get<Payable>(`/payables/${id}`)).data,
    enabled: !!id,
  })
}

export function useAddPayablePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; paidAt?: string; amount?: number; method?: string; reference?: string; note?: string }) => {
      const { id, method, ...rest } = input
      const payload: any = {
        payableId: id,
        ...rest,
        paidAt: rest.paidAt ?? new Date().toISOString().slice(0, 10),
      }
      if (method) {
        payload.method = method
        payload.paymentMethod = method
      }
      const res = await api.post(`/payables/${id}/payments`, payload)
      return res.data
    },
    onSuccess: (_data, vars) => {
      const id = (vars as any).id
      if (id) qc.invalidateQueries({ queryKey: ['payable', id] })
      qc.invalidateQueries({ queryKey: ['payables'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCancelPayable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/payables/${id}/cancel`, {})).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['payable', id] })
      qc.invalidateQueries({ queryKey: ['payables'] })
    },
  })
}

// ============================================================
// 🧩 RECEIVABLES
// ============================================================

export function useReceivables(params: {
  status?: 'open' | 'paid' | 'canceled'
  customerId?: string
  from?: string
  to?: string
  q?: string
}) {
  return useQuery({
    queryKey: ['receivables', params],
    queryFn: async () => (await api.get<Receivable[]>('/finance/receivables', { params })).data,
  })
}

export function useCreateReceivable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      dueDate: string
      amount: number | string
      method?: string
      nfeId?: string
      note?: string
    }) => {
      const payload = {
        customerId: String(input.customerId).trim(),
        dueDate: String(input.dueDate),
        amount: Number(input.amount),
        paymentMethod: input.method,
        nfeId: input.nfeId,
        ...(input.note ? { note: input.note } : {}),
      }
      const res = await api.post<Receivable>('/finance/receivables', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivables'] }),
  })
}

export function useReceivable(id?: string) {
  return useQuery({
    queryKey: ['receivable', id],
    queryFn: async () => (await api.get<Receivable>(`/finance/receivables/${id}`)).data,
    enabled: !!id,
  })
}

export function useAddReceivablePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; paidAt?: string; amount: number; method?: string; reference?: string; note?: string }) => {
      const { id, ...body } = input
      const payload: any = {
        receivableId: id,
        paidAt: body.paidAt ?? new Date().toISOString().slice(0, 10),
        amount: body.amount,
        method: body.method,
        paymentMethod: body.method,
        reference: body.reference,
        note: body.note,
      }
      const res = await api.post(`/finance/receivables/${id}/payments`, payload)
      return res.data
    },
    onSuccess: (_data, vars) => {
      const id = (vars as any).id
      if (id) qc.invalidateQueries({ queryKey: ['receivable', id] })
      qc.invalidateQueries({ queryKey: ['receivables'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCancelReceivable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/finance/receivables/${id}/cancel`, {})).data,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['receivable', id] })
      qc.invalidateQueries({ queryKey: ['receivables'] })
    },
  })
}

export type ReceivablePayment = {
  id: string
  receivableId: string
  paidAt: string
  amount: string
  method?: string | null
  reference?: string | null
  note?: string | null
  createdAt: string
}

export function useReceivablePayments(id?: string) {
  return useQuery({
    queryKey: ['receivable-payments', id],
    queryFn: async () => {
      const res = await api.get<ReceivablePayment[]>(`/finance/receivables/${id}/payments`)
      return res.data
    },
    enabled: !!id,
  })
}

// ============================================================
// 🧩 DASHBOARD
// ============================================================

export type DashboardSummary = {
  periodo: { mesAtual: number; anoAtual: number; label: string }
  faturamento: {
    atual: number
    anterior: number
    variacao: number | null
    nfsEmitidas: number
    nfsEmitidasAnterior: number
  }
  recebiveis: {
    totalAberto: number
    countAberto: number
    totalVencido: number
    countVencido: number
  }
  payables: {
    totalAberto: number
    countAberto: number
    totalVencido: number
    countVencido: number
  }
  grafico: Array<{ label: string; mes: number; ano: number; total: number; porCliente: { customerId: string; total: number }[] }>
  graficoQtd: Array<{ label: string; mes: number; ano: number; qtd: number }>
  graficoFluxo: Array<{ label: string; mes: number; ano: number; entradas: number; saidas: number; saldo: number }>
  topClientes: Array<{ customerId: string | null; name: string; totalFaturado: number; totalNfs: number }>
  alertasBillings: Array<{ id: string; cliente: string; mes: number; ano: number; total: number; status: string }>
  tabelaProducao?: Array<{ empresa: string; processo: string; qtd: number; unit: string }>
  ultimasTransacoes?: Array<{ tipo: 'entrada' | 'saida'; data: string; valor: number; contraparte: string }>
}

export function useDashboard(mes?: number, ano?: number) {
  return useQuery({
    queryKey: ['dashboard', mes, ano],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary', {
      params: { ...(mes ? { mes } : {}), ...(ano ? { ano } : {}) },
    })).data,
    refetchInterval: 5 * 60 * 1000,
  })
}

// ============================================================
// 🧩 BILLING
// ============================================================

export type Billing = {
  id: string
  tenantId: string
  companyId: string
  customerId: string
  billingNumber?: number
  month: number
  year: number
  totalAmount: string
  status: 'open' | 'sent' | 'paid' | 'overdue'
  sentAt: string | null
  dueDate: string   // always set — billing is keyed per dueDate
  paidAt?: string | null
  createdAt: string
  customer?: { id: string; name: string; email?: string | null; accountantEmail?: string | null }
  receivables?: { id: string; amount: string; dueDate: string; status: string; nfeId?: string | null }[]
}

export function useBillings(params: {
  status?: string
  customerId?: string
  year?: number
  month?: number
}) {
  return useQuery({
    queryKey: ['billings', params],
    queryFn: async () => (await api.get<Billing[]>('/billing', { params })).data,
  })
}

export function useGenerateBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { customerId: string; month: number; year: number }) =>
      (await api.post('/billing/generate', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}

export function useSendBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/${id}/send`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}

export function useMarkBillingPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/${id}/paid`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}

export function useReceiveBillingFull() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; paidAt?: string; method?: string; note?: string }) =>
      (await api.post(`/billing/${id}/receive`, dto)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] })
      qc.invalidateQueries({ queryKey: ['billings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCancelBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/billing/${id}/cancel`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}

// ============================================================
// 🧩 CUSTOMERS
// ============================================================
export function useCustomers(q?: string) {
  return useQuery({
    queryKey: ['customers', q],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { q },
      })
      return Array.isArray(res.data) ? res.data : []
    },
  })
}
export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`, {
        params: {
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
        },
      })
      return res.data
    },
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/customers', {
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        ...data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: any) => 
      api.patch<Customer>(`/customers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({id, data}: any) =>
      api.delete(`/customers/${id}`, data),
    onSuccess: () => 
	qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

// ============================================================
// 🧩 NFemit
// ============================================================

export function useNfePreviewFromStock() {
  return useMutation({
    mutationFn: async (payload: { tenantId: string; companyId: string; stockLotIds: string[] }) => {
      const { data } = await api.post('/nfe-emit/preview-from-stock', payload)
      return data
    },
  })
}

export function useNfeCreateDraftFromStock() {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/nfe-emit/create-draft', payload)
      return data
    },
  })
}

// ✅ Transportadoras
export function useTransportersList(params: {
  tenantId: string
  companyId: string
  q?: string
}) {
  const api = useApi()

  return useQuery({
    queryKey: ['transporters', params.tenantId, params.companyId, params.q ?? ''],
    queryFn: async () => {
      const res: any = await api.get('/transporter', { params })
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return list
    },
    enabled: !!params.tenantId && !!params.companyId,
  })
}


export function useUnbilledReceivables() {
  return useQuery({
    queryKey: ['unbilled-receivables'],
    queryFn: async () => {
      const res = await api.get('/billing/unbilled-receivables', {
        params: { tenantId: TENANT_ID, companyId: COMPANY_ID },
      })
      return res.data as Array<{ customerId: string; customerName: string; total: number; count: number; nfs: string[] }>
    },
  })
}

export function useDeleteTransporter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/transporter/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transporters'] }),
  })
}

export function useUpdateTransporter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      (await api.patch(`/transporter/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transporters'] }),
  })
}

export function useCompany(companyId?: string) {
  return useQuery({
    queryKey: ['company', companyId ?? COMPANY_ID],
    queryFn: async () => {
      const res = await api.get('/companies', { params: { tenantId: TENANT_ID } })
      const list: any[] = Array.isArray(res.data) ? res.data : []
      return list.find(c => c.id === (companyId ?? COMPANY_ID)) ?? list[0] ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTransporter(id?: string) {
  return useQuery({
    queryKey: ['transporter', id],
    queryFn: async () => (await api.get(`/transporter/${id}`)).data,
    enabled: !!id,
  })
}

export function useDeleteNfe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/nfe-emit/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nfe-list'] }),
  })
}

export function useCancelNfeById() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/nfe-emit/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nfe-list'] }),
  })
}

// ============================================================
// 🧩 GENÉRICO
// ============================================================

export function useApi() {
  return {
    get: async (url: string, config?: any) => {
      const res = await api.get(url, config)
      return res.data
    },
    post: async (url: string, body?: any, config?: any) => {
      // 🚫 Não desmontar FormData
      const res =
        body instanceof FormData
          ? await api.post(url, body, config)
          : await api.post(url, { ...(body || {}) }, config)
      return res.data
    },
    put: async (url: string, body?: any, config?: any) => {
      const res = await api.put(url, { ...(body || {}) }, config)
      return res.data
    },
    patch: async (url: string, body?: any, config?: any) => {
      const res = await api.patch(url, { ...(body || {}) }, config)
      return res.data
    },
    delete: async (url: string, config?: any) => {
      const res = await api.delete(url, config)
      return res.data
    },
  }
}
