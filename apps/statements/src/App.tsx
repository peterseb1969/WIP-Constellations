import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AccountsPage from './pages/AccountsPage'
import TransactionsPage from './pages/TransactionsPage'
import PayslipsPage from './pages/PayslipsPage'
import ImportPage from './pages/ImportPage'
import CategoryRulesPage from './pages/CategoryRulesPage'
import ImportsPage from './pages/ImportsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="payslips" element={<PayslipsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="imports" element={<ImportsPage />} />
        <Route path="rules" element={<CategoryRulesPage />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  )
}
