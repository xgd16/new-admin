import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  useLocation,
  useRoutes,
} from 'react-router-dom'

import { Spinner, Text } from '@heroui/react'
import { I18nProvider } from 'react-aria-components'

import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/authContext'
import { motion } from './components/motionConfig'
import { AdminLayout } from './layouts/AdminLayout'
import { FrontUsersPage } from './pages/FrontUsersPage'
import { LoginPage } from './pages/LoginPage'
import { OperationLogsPage } from './pages/OperationLogsPage'
import { OverviewPage } from './pages/OverviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { SystemRolesPage } from './pages/SystemRolesPage'
import { SystemUsersPage } from './pages/SystemUsersPage'
import { ThemeProvider } from './theme/ThemeProvider'

function BootGate({ children }: { children: React.ReactNode }) {
  const { bootstrapping } = useAuth()
  if (bootstrapping) {
    return (
      <motion.div
        className="app-shell flex min-h-svh items-center justify-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Spinner size="md" />
        <span className="sr-only">初始化</span>
        <Text variant="muted">正在初始化工作台…</Text>
      </motion.div>
    )
  }
  return <>{children}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const loc = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

function AppRoutes() {
  useEffect(() => {
    document.title = 'Web Admin'
  }, [])

  return useRoutes([
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <OverviewPage /> },
        { path: 'front/users', element: <FrontUsersPage /> },
        { path: 'system/users', element: <SystemUsersPage /> },
        { path: 'system/roles', element: <SystemRolesPage /> },
        { path: 'system/operation-logs', element: <OperationLogsPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
  ])
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider locale="zh-CN">
          <AuthProvider>
            <BootGate>
              <AppRoutes />
            </BootGate>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
