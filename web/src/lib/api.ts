import axios from 'axios'

// ============================================================
// 🔧 Configuração base do cliente Axios
// ============================================================

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

// ============================================================
// 🔢 Constantes globais (mantidas para retrocompatibilidade)
// ============================================================
// IDs fixos (multi-tenant ainda futuro)
export const TENANT_ID = 'T-001'
export const COMPANY_ID = 'C-001'

// ============================================================
// 🧩 Interceptores globais
// ============================================================

// ✅ Interceptor de requisição
// Injeta o JWT no header Authorization (se existir) e tenantId/companyId como fallback
api.interceptors.request.use((config) => {
  // Injeta o token JWT em toda requisição autenticada
  const token = localStorage.getItem('erp_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }

  const tenantId = TENANT_ID
  const companyId = COMPANY_ID

  if (
    ['post', 'put', 'patch'].includes(config.method || '') &&
    config.data &&
    typeof config.data === 'object'
  ) {
    config.data.tenantId ??= tenantId
    config.data.companyId ??= companyId
  }

  if (
    ['get', 'delete'].includes(config.method || '') &&
    config.params &&
    typeof config.params === 'object'
  ) {
    config.params.tenantId ??= tenantId
    config.params.companyId ??= companyId
  }

  return config
})



api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Se o servidor retornar 401 (token inválido/expirado), desloga e vai para login
    if (err?.response?.status === 401) {
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_user')
      window.location.href = '/login'
      return Promise.reject(err)
    }

    const message =
      err?.response?.data?.message ||
      err?.message ||
      'Erro inesperado. Verifique sua conexão ou tente novamente.'

    console.error('❌ Erro API:', {
      url: err?.config?.url,
      method: err?.config?.method,
      status: err?.response?.status,
      message,
    })

    return Promise.reject({
      status: err?.response?.status || 500,
      message,
      details: err?.response?.data || null,
    })
  }
)


// ============================================================
// 🧱 Tipagens compartilhadas em todo o ERP
// ============================================================

// ---- PRODUCTS ----
export type Product = {
  id: string
  tenantId: string
  companyId: string
  sku: string
  name: string
  unit?: string | null
  ncm?: string | null
  cfop?: string | null
  price: string
  taxes?: any | null
  empresaOrigem?: { id: string; nome?: string } | null
  processId?: string | null
  empresaTipo?: string | null
  createdAt: string
  updatedAt?: string
}

// ---- WAREHOUSE ----
export type Warehouse = {
  id: string
  tenantId: string
  companyId: string
  name: string
  code: string
  createdAt: string
}

// ---- BALANCE ----
export type BalanceRow = {
  productId: string
  warehouseId: string
  ownership: 'own' | 'third_party_in' | 'third_party_out'
  qty: string
}

// ---- SUPPLIERS ----
export type Supplier = {
  id: string
  tenantId: string
  companyId: string
  docType: 'CNPJ' | 'CPF' | string
  document: string
  name: string
  email?: string | null
  phone?: string | null
  createdAt: string
}

// ---- PAYABLES ----
export type PayableStatus = 'open' | 'paid' | 'canceled'
export type PaymentMethod = 'transfer' | 'pix' | 'boleto' | 'cash' | 'card' | string

export type Payable = {
  id: string
  tenantId: string
  companyId: string
  supplierId: string
  nfeReceivedId?: string | null
  dueDate: string
  amount: string
  status: PayableStatus
  paymentMethod: PaymentMethod
  category?: string | null
  createdAt: string
  payments?: Array<{ id: string; paidAt: string; amount: string; reference?: string | null }>
}

// ---- RECEIVABLES ----
export type ReceivableStatus = 'open' | 'paid' | 'canceled'

export type Receivable = {
  id: string
  tenantId: string
  companyId: string
  customerId: string
  nfeId?: string | null
  dueDate: string
  amount: string
  status: ReceivableStatus
  createdAt: string
}

// ---- PAYMENTS ----
export type Payment = {
  id: string
  receivableId: string
  paidAt: string
  amount: string
  method?: string | null
  reference?: string | null
  note?: string | null
  createdAt: string
}

// ---- CUSTOMERS ----
export type Customer = {
  id: string
  tenantId: string
  companyId: string
  docType: 'CNPJ' | 'CPF'
  document: string
  name: string
  ie?: string | null
  email?: string | null
  address?: string | null
  zip?: string | null
  createdAt: string
}
