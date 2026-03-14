import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  FileText,
  Upload,
  Menu,
  X,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Landmark, label: 'Accounts' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/payslips', icon: FileText, label: 'Payslips' },
  { to: '/import', icon: Upload, label: 'Import' },
]

function Breadcrumb() {
  const location = useLocation()
  const path = location.pathname
  const segment = path === '/' ? 'Dashboard' : path.slice(1).charAt(0).toUpperCase() + path.slice(2)

  return (
    <nav className="text-sm text-text-muted">
      <span>Statement Manager</span>
      <span className="mx-2">/</span>
      <span className="text-text">{segment}</span>
    </nav>
  )
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-primary text-white h-14 flex items-center px-4 gap-4 shrink-0">
        <button
          className="lg:hidden p-1"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Landmark size={24} />
        <h1 className="font-semibold text-lg">Statement Manager</h1>
        <div className="flex-1" />
        <Breadcrumb />
        <a
          href="/"
          className="p-1 hover:bg-primary-light rounded-md transition-colors"
          title="Portal Home"
        >
          <Home size={20} />
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'bg-white border-r border-gray-200 w-56 shrink-0 flex flex-col',
            'transition-transform duration-200 ease-in-out',
            'lg:translate-x-0 lg:static',
            'fixed inset-y-14 left-0 z-30',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-muted hover:bg-gray-100 hover:text-text',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
