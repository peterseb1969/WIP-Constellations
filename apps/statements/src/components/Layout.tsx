import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  FileText,
  Upload,
  FolderOpen,
  Home,
  Tags,
} from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { to: '', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: 'accounts', icon: Landmark, label: 'Accounts' },
  { to: 'transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: 'payslips', icon: FileText, label: 'Pay Slips' },
  { to: 'import', icon: Upload, label: 'Import' },
  { to: 'imports', icon: FolderOpen, label: 'Files' },
  { to: 'rules', icon: Tags, label: 'Rules' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-primary text-white h-14 flex items-center px-4 shrink-0">
        <a href="/" className="mr-4 hover:text-primary-light transition-colors" title="Portal Home">
          <Home className="w-5 h-5" />
        </a>
        <h1 className="text-lg font-semibold">Statement Manager</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 bg-white border-r shrink-0 py-4 hidden md:block">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-primary hover:bg-gray-100'
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50">
          <ul className="flex justify-around py-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-0.5 text-xs transition-colors',
                      isActive ? 'text-primary' : 'text-text-muted'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
