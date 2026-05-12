import { lazy, Suspense, useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  useLocation,
  useRoutes,
} from 'react-router-dom'

import { Spinner, Text, Toast } from '@heroui/react'
import { I18nProvider } from 'react-aria-components'

import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/authContext'
import { motion } from './components/motionConfig'
import { AdminLayout } from './layouts/AdminLayout'
import { ThemeProvider } from './theme/ThemeProvider'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
)
const FrontUsersPage = lazy(() =>
  import('./pages/FrontUsersPage').then((m) => ({ default: m.FrontUsersPage })),
)
const SystemUsersPage = lazy(() =>
  import('./pages/SystemUsersPage').then((m) => ({ default: m.SystemUsersPage })),
)
const SystemRolesPage = lazy(() =>
  import('./pages/SystemRolesPage').then((m) => ({ default: m.SystemRolesPage })),
)
const OperationLogsPage = lazy(() =>
  import('./pages/OperationLogsPage').then((m) => ({ default: m.OperationLogsPage })),
)
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3">
      <Spinner size="md" />
      <Text variant="muted">加载页面…</Text>
    </div>
  )
}

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

  return (
    <Suspense fallback={<RouteFallback />}>
      {useRoutes([
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
            { path: 'profile', element: <ProfilePage /> },
            { path: 'settings', element: <SettingsPage /> },
          ],
        },
        { path: '*', element: <Navigate to="/dashboard" replace /> },
      ])}
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider locale="zh-CN">
          {/* ToastRegion 无队列内容时返回 null；若包裹整站会导致白屏，须与业务树并列 */}
          <Toast.Provider placement="top" />
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
