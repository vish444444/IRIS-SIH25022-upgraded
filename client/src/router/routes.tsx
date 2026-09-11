import { Simulation } from '@/pages/Simulation'
import { JsonMapDemo } from '@/pages/JsonMapDemo'
import { Landing } from '@/pages/Landing'
import Login from '@/pages/Login'
import ChangePassword from '@/pages/ChangePassword'
import AdminUsers from '@/pages/AdminUsers'
import AdminTimetable from '@/pages/AdminTimetable'
import { ControllerDashboard, SignalsDashboard, DriverDashboard } from '@/pages/DashboardPlaceholder'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Route, Routes, Navigate } from 'react-router-dom'

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/simulation" element={<Simulation />} />
      <Route path="/json-map" element={<JsonMapDemo />} />

      {/* Change password (authenticated but before force check) */}
      <Route path="/change-password" element={<ChangePassword />} />

      {/* Admin routes (system_admin only) */}
      <Route element={<ProtectedRoute allowedRoles={["system_admin"]} />}>
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/timetable" element={<AdminTimetable />} />
      </Route>

      {/* Protected role-based dashboards */}
      <Route element={<ProtectedRoute allowedRoles={["section_controller", "system_admin"]} />}>
        <Route path="/dashboard/controller" element={<ControllerDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={["signal_operator", "system_admin"]} />}>
        <Route path="/dashboard/signals" element={<SignalsDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={["loco_pilot", "system_admin"]} />}>
        <Route path="/dashboard/driver" element={<DriverDashboard />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes
