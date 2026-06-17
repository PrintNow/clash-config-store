import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export function AdminRoute() {
  const { user } = useAuthStore()

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
