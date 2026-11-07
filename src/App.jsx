import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotifProvider } from './context/NotifContext'
import { Spinner } from './components/ui/index.jsx'

// Public pages
import LandingPage    from './pages/public/LandingPage'
import RegisterPage   from './pages/public/RegisterPage'
import OrgStatusPage  from './pages/public/OrgStatusPage'
import LoginPage      from './pages/auth/LoginPage'
import JoinPage       from './pages/auth/JoinPage'
import SetupAccountPage from './pages/auth/SetupAccountPage'

// District Admin pages
import DistrictDashboard      from './pages/district/DistrictDashboard'
import DistrictOrganizations  from './pages/district/DistrictOrganizations'
import DistrictAnalytics      from './pages/district/DistrictAnalytics'
import PaymentsPage           from './pages/district/PaymentsPage'

// Organization Admin pages
import OrgDashboard      from './pages/organization/OrgDashboard'
import UsersPage         from './pages/organization/UsersPage'
import OrgAnalyticsPage  from './pages/organization/OrgAnalyticsPage'

// Shared pages
import ClassesPage from './pages/shared/ClassesPage'

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TasksListPage    from './pages/teacher/TasksListPage'
import CreateTaskPage   from './pages/teacher/CreateTaskPage'
import SubmissionsPage  from './pages/teacher/SubmissionsPage'

// Student pages
import StudentDashboard     from './pages/student/StudentDashboard'
import StudentTasksListPage from './pages/student/StudentTasksListPage'
import TaskSubmitPage       from './pages/student/TaskSubmitPage'
import StudentResultsPage   from './pages/student/StudentResultsPage'

// Shared
import SettingsPage from './pages/SettingsPage'

// Parent portal (separate session, see services/parentApi.js)
import ParentLogin     from './pages/parent/ParentLogin'
import ParentDashboard from './pages/parent/ParentDashboard'
import { getParentSession } from './services/parentApi'

function RequireParent({ children }) {
  return getParentSession() ? children : <Navigate to="/parent/login" replace />
}

// ── Auth Guard ────────────────────────────────────────────────────────────────
function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  const location          = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gov-light">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRole = user.role || user.userType
  if (roles && !roles.includes(userRole)) {
    return <Navigate to={getDefaultRoute(userRole)} replace />
  }

  return children
}

// ── Guest Guard ───────────────────────────────────────────────────────────────
function GuestOnly({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gov-light">
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) {
    const role = user.role || user.userType
    return <Navigate to={getDefaultRoute(role)} replace />
  }

  return children
}

function getDefaultRoute(role) {
  const routes = {
    district_admin:    '/district',
    organization_admin:'/org',
    teacher:           '/teacher',
    worker:            '/teacher',
    student:           '/student',
    intern:            '/student',
  }
  return routes[role] || '/login'
}

// ── App ───────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"            element={<LandingPage />} />
      <Route path="/register"    element={<RegisterPage />} />
      <Route path="/org-status"  element={<OrgStatusPage />} />
      <Route path="/setup-account" element={<SetupAccountPage />} />

      {/* Auth */}
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/join"  element={<GuestOnly><JoinPage  /></GuestOnly>} />

      {/* Parent portal */}
      <Route path="/parent/login" element={
        getParentSession() ? <Navigate to="/parent/dashboard" replace /> : <ParentLogin />
      } />
      <Route path="/parent/dashboard" element={<RequireParent><ParentDashboard /></RequireParent>} />
      <Route path="/parent" element={<Navigate to="/parent/dashboard" replace />} />

      {/* District Admin */}
      <Route path="/district" element={
        <RequireAuth roles={['district_admin']}><DistrictDashboard /></RequireAuth>
      } />
      <Route path="/district/organizations" element={
        <RequireAuth roles={['district_admin']}><DistrictOrganizations /></RequireAuth>
      } />
      <Route path="/district/analytics" element={
        <RequireAuth roles={['district_admin']}><DistrictAnalytics /></RequireAuth>
      } />
      <Route path="/district/payments" element={
        <RequireAuth roles={['district_admin']}><PaymentsPage /></RequireAuth>
      } />

      {/* Organization Admin */}
      <Route path="/org" element={
        <RequireAuth roles={['organization_admin']}><OrgDashboard /></RequireAuth>
      } />
      <Route path="/org/users" element={
        <RequireAuth roles={['organization_admin']}><UsersPage /></RequireAuth>
      } />
      <Route path="/org/classes" element={
        <RequireAuth roles={['organization_admin']}><ClassesPage /></RequireAuth>
      } />
      <Route path="/org/analytics" element={
        <RequireAuth roles={['organization_admin']}><OrgAnalyticsPage /></RequireAuth>
      } />

      {/* Teacher / Worker */}
      <Route path="/teacher" element={
        <RequireAuth roles={['teacher', 'worker']}><TeacherDashboard /></RequireAuth>
      } />
      <Route path="/teacher/tasks" element={
        <RequireAuth roles={['teacher', 'worker']}><TasksListPage /></RequireAuth>
      } />
      <Route path="/teacher/tasks/:id" element={
        <RequireAuth roles={['teacher', 'worker']}><SubmissionsPage /></RequireAuth>
      } />
      <Route path="/teacher/create-task" element={
        <RequireAuth roles={['teacher', 'worker']}><CreateTaskPage /></RequireAuth>
      } />
      <Route path="/teacher/classes" element={
        <RequireAuth roles={['teacher', 'worker']}><ClassesPage /></RequireAuth>
      } />

      {/* Student / Intern */}
      <Route path="/student" element={
        <RequireAuth roles={['student', 'intern']}><StudentDashboard /></RequireAuth>
      } />
      <Route path="/student/tasks" element={
        <RequireAuth roles={['student', 'intern']}><StudentTasksListPage /></RequireAuth>
      } />
      <Route path="/student/tasks/:id" element={
        <RequireAuth roles={['student', 'intern']}><TaskSubmitPage /></RequireAuth>
      } />
      <Route path="/student/results" element={
        <RequireAuth roles={['student', 'intern']}><StudentResultsPage /></RequireAuth>
      } />

      {/* Shared */}
      <Route path="/settings" element={
        <RequireAuth><SettingsPage /></RequireAuth>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotifProvider>
        <AppRoutes />
      </NotifProvider>
    </AuthProvider>
  )
}
