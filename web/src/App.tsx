import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/auth/LoginPage'
import CustomersList from './pages/customers/CustomersList'
import CustomerForm from './pages/customers/CustomerForm'
import NfeList from './pages/nfe-emit/NfeList'
import NfeForm from './pages/nfe-emit/NfeForm'
import { NfePreview } from './pages/nfe-emit/NFePreview'
import NfeEmitFromStockPage from './pages/nfe-emit/NfeEmitFromStockPage'
import NfeDraftDetailPage from './pages/nfe-emit/NfeDraftDetailPage'
import NfeImportList from './pages/nfe-import/NFeImportList'
import ProductsList from './pages/products/ProductsList'
import ProductForm from './pages/products/ProductForm'
import ProcessesList from './pages/processes/ProcessesList'
import ProcessesForm from './pages/processes/ProcessesForm'
import PayablesList from './pages/payables/PayablesList'
import PayableForm from './pages/payables/PayableForm'
import ReceivablesList from './pages/receivables/ReceivablesList'
import ReceivableForm from './pages/receivables/ReceivableForm'
import BillingList from './pages/billing/BillingList'
import DashboardPage from './pages/dashboard/DashboardPage'
import StockPage from './pages/inventory/StockPage'
import StockMoveForm from './pages/inventory/StockMoveForm'
import StockHistoryPage from './pages/inventory/StockHistoryPage'
import StockHistoryListPage from './pages/inventory/StockHistoryListPage'
import SuppliersList from './pages/suppliers/SuppliersList'
import SupplierForm from './pages/suppliers/SupplierForm'
import TransporterList from './pages/transporter/TransporterList'
import TransporterForm from './pages/transporter/TransporterForm'
import WarehousesList from './pages/inventory/WarehousesList'
import FinanceiroHistoricoPage from './pages/financeiro/FinanceiroHistoricoPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública — fora do Layout e fora do ProtectedRoute */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas protegidas — ProtectedRoute redireciona para /login se não autenticado */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Admin-only */}
            <Route element={<AdminRoute />}>
              <Route path="/products" element={<ProductsList />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:id" element={<ProductForm />} />
              <Route path="/suppliers" element={<SuppliersList />} />
              <Route path="/suppliers/new" element={<SupplierForm />} />
              <Route path="/suppliers/:id" element={<SupplierForm />} />
              <Route path="/transporter" element={<TransporterList />} />
              <Route path="/transporter/new" element={<TransporterForm />} />
              <Route path="/transporter/:id" element={<TransporterForm />} />
              <Route path="/customers" element={<CustomersList />} />
              <Route path="/customers/new" element={<CustomerForm />} />
              <Route path="/customers/:id" element={<CustomerForm />} />
              <Route path="/nfe-import" element={<NfeImportList />} />
              <Route path="/inventory/warehouses" element={<WarehousesList />} />
            </Route>

            {/* All authenticated users */}
            <Route path="/processes" element={<ProcessesList />} />
            <Route path="/processes/new" element={<ProcessesForm />} />
            <Route path="/processes/:id" element={<ProcessesForm />} />

            <Route path="/inventory/stock" element={<StockPage />} />
            <Route path="/inventory/stock/move/:productId" element={<StockMoveForm />} />
            <Route path="/inventory/stock/move/new" element={<StockMoveForm />} />
            <Route path="/inventory/stock/:productId/history" element={<StockHistoryPage />} />
            <Route path="/inventory/stock/history" element={<StockHistoryListPage />} />

            <Route path="/payables" element={<PayablesList />} />
            <Route path="/payables/new" element={<PayableForm />} />
            <Route path="/payables/:id" element={<PayableForm />} />

            <Route path="/receivables" element={<ReceivablesList />} />
            <Route path="/receivables/new" element={<ReceivableForm />} />
            <Route path="/receivables/:id" element={<ReceivableForm />} />

            <Route path="/billing" element={<BillingList />} />
            <Route path="/financeiro/historico" element={<FinanceiroHistoricoPage />} />

            <Route path="/nfe/emit/from-stock" element={<NfeEmitFromStockPage />} />
            <Route path="/nfe-emit" element={<NfeList />} />
            <Route path="/nfe-emit/form" element={<NfeForm />} />
            <Route path="/nfe-emit/:id" element={<NfeDraftDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
