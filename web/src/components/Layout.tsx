import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  LayoutDashboard,
  Users,
  Package,
  Cog,
  FileText,
  TrendingUp,
  Warehouse,
  Truck,
  Factory,
  DollarSign,
  Receipt,
  CreditCard,
  ChevronLeft,
  LogOut,
  Menu,
  ShoppingCart,
  X,
} from 'lucide-react'

// ─── Estrutura de navegação ───────────────────────────────────────────────────

// roles: undefined = todos | ['ADMIN'] = só admin
type NavItem = { to: string; icon: React.ElementType; label: string; roles?: string[] }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Geral',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/customers',  icon: Users,            label: 'Clientes', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Operações',
    items: [
      { to: '/products',        icon: Package,      label: 'Produtos',       roles: ['ADMIN'] },
      { to: '/processes',       icon: Cog,           label: 'Processos' },
      { to: '/inventory/stock', icon: Warehouse,     label: 'Estoque' },
      { to: '/suppliers',       icon: ShoppingCart,  label: 'Fornecedores',  roles: ['ADMIN'] },
      { to: '/transporter',     icon: Truck,         label: 'Transportadoras', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Fiscal',
    items: [
      { to: '/nfe-emit',   icon: FileText, label: 'Emissão NF-e' },
      { to: '/nfe-import', icon: FileText, label: 'NF-e Entrada', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/receivables', icon: TrendingUp,  label: 'A Receber' },
      { to: '/payables',    icon: CreditCard,  label: 'A Pagar' },
      { to: '/billing',     icon: Receipt,     label: 'Faturamento' },
    ],
  },
]

// Bottom nav items (mobile — itens mais usados pelo gerente)
const BOTTOM_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/processes',       icon: Cog,             label: 'Processos' },
  { to: '/inventory/stock', icon: Warehouse,       label: 'Estoque' },
  { to: '/nfe-emit',        icon: FileText,        label: 'NF-e' },
  { to: '/receivables',     icon: TrendingUp,      label: 'A Receber' },
]

// Mapa rota → título da página (para o header superior)
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/customers':          'Clientes',
  '/products':           'Produtos',
  '/processes':          'Processos',
  '/inventory/stock':    'Estoque',
  '/inventory/warehouses': 'Depósitos',
  '/suppliers':          'Fornecedores',
  '/transporter':        'Transportadoras',
  '/nfe-emit':           'Emissão NF-e',
  '/nfe-import':         'NF-e Entrada',
  '/receivables':        'Contas a Receber',
  '/payables':           'Contas a Pagar',
  '/billing':            'Faturamento',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const prefix = Object.keys(PAGE_TITLES).find(k => pathname.startsWith(k) && k !== '/')
  return prefix ? PAGE_TITLES[prefix] : 'ERP Tapajós'
}

// ─── Layout Principal ─────────────────────────────────────────────────────────

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role ?? 'MANAGER'

  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item => !item.roles || item.roles.includes(role)),
  })).filter(g => g.items.length > 0)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const pageTitle = getPageTitle(pathname)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col bg-tapajos-900
          transition-transform duration-200 w-72
          md:hidden
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-tapajos-800 shrink-0">
          <span className="font-bold text-white text-base tracking-tight leading-tight">
            Tapajós <span className="text-tapajos-300 font-normal text-xs tracking-widest uppercase">ERP</span>
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-tapajos-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-5 scrollbar-none">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <p className="px-4 mb-1 text-[10px] font-semibold text-tapajos-400 uppercase tracking-widest">
                {group.label}
              </p>
              <ul className="space-y-0.5 px-2">
                {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    active={pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to))}
                    collapsed={false}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-tapajos-800 py-3 px-4 shrink-0">
          {user && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-tapajos-400 truncate">{user.email}</p>
              <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${user.role === 'ADMIN' ? 'bg-tapajos-600 text-white' : 'bg-amber-700 text-amber-100'}`}>
                {user.role === 'ADMIN' ? 'Admin' : 'Gerente'}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-tapajos-400 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`
          hidden md:flex flex-col shrink-0 bg-tapajos-900 transition-all duration-200
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {/* Logo */}
        <div className={`h-14 flex items-center shrink-0 border-b border-tapajos-800
          ${collapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}>
          {!collapsed && (
            <span className="font-bold text-white text-base tracking-tight leading-tight">
              Tapajós<br />
              <span className="text-tapajos-300 font-normal text-xs tracking-widest uppercase">ERP</span>
            </span>
          )}
          {collapsed && (
            <span className="font-bold text-white text-lg">T</span>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-5 scrollbar-none">
          {visibleGroups.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-4 mb-1 text-[10px] font-semibold text-tapajos-400 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    active={pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to))}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="border-t border-tapajos-800 py-3 px-2 space-y-1 shrink-0">
          {!collapsed && user && (
            <div className="px-2 py-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-tapajos-400 truncate">{user.email}</p>
              <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${user.role === 'ADMIN' ? 'bg-tapajos-600 text-white' : 'bg-amber-700 text-amber-100'}`}>
                {user.role === 'ADMIN' ? 'Admin' : 'Gerente'}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-tapajos-400 hover:bg-tapajos-800 hover:text-white transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
            title="Sair"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(v => !v)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-tapajos-400 hover:bg-tapajos-800 hover:text-white transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed
              ? <Menu size={16} className="shrink-0" />
              : <><ChevronLeft size={16} className="shrink-0" /><span>Recolher</span></>
            }
          </button>
        </div>
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header */}
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-base font-semibold text-slate-900 truncate">{pageTitle}</h1>
          <div className="flex-1" />
          {import.meta.env.DEV && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wide">
              Dev
            </span>
          )}
        </header>

        {/* Conteúdo da página — padding bottom extra no mobile para bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom Navigation — mobile only ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex">
        {BOTTOM_NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors text-[10px] font-medium
                ${active ? 'text-tapajos-600' : 'text-slate-500'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

// ─── Nav Link ─────────────────────────────────────────────────────────────────

function NavLink({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  to: string
  icon: React.ElementType
  label: string
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  return (
    <li>
      <Link
        to={to}
        title={collapsed ? label : undefined}
        onClick={onClick}
        className={`
          flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors
          ${active
            ? 'bg-tapajos-600 text-white font-medium'
            : 'text-tapajos-300 hover:bg-tapajos-800 hover:text-white'
          }
          ${collapsed ? 'justify-center' : ''}
        `}
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  )
}
