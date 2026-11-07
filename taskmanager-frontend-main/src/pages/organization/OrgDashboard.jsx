import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, BookOpen, ClipboardList, TrendingUp, UserPlus, Upload } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatCard, Badge, DataTable, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import { orgAPI, userAPI, classAPI, taskAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const ROLE_COLORS = { teacher: '#1E3A8A', student: '#065F46', worker: '#D97706', intern: '#6B7280', organization_admin: '#7C3AED' }
const PIE_COLORS  = ['#1E3A8A', '#065F46', '#D97706', '#6B7280', '#7C3AED']

const MOCK_PERF = [
  { class: 'Math 10',  completion: 85 },
  { class: 'Eng 10',   completion: 72 },
  { class: 'Sci 10',   completion: 91 },
  { class: 'Hist 10',  completion: 68 },
  { class: 'Geo 10',   completion: 79 },
]

export default function OrgDashboard() {
  const { user } = useAuth()
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([orgAPI.getStats(), userAPI.getAll({ limit: 5 })])
      .then(([s, u]) => {
        setStats(s.data.data)
        setUsers(u.data.data || [])
      })
      .catch(() => {
        setStats(null)
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [])

  const roleData = stats?.users_by_role?.map(r => ({
    name: r.role,
    value: parseInt(r.count)
  })) || [
    { name: 'teacher', value: 8 },
    { name: 'student', value: 35 },
    { name: 'worker',  value: 5  },
  ]

  const recentUserCols = [
    { key: 'name',   label: 'Name',   render: r => <span className="font-medium text-sm">{r.name}</span> },
    { key: 'email',  label: 'Email',  render: r => <span className="text-xs text-gray-500">{r.email}</span> },
    { key: 'role',   label: 'Role',   render: r => <Badge status={r.role} /> },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status} /> },
  ]

  if (loading) return <DashboardLayout title="Dashboard"><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout
      title="Organization Dashboard"
      subtitle={`${user?.organization?.name || 'Your Organization'} · Admin`}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users"   value={stats?.total_users  || 0} icon={Users}        color="blue"  />
        <StatCard label="Active Users"  value={stats?.active_users || 0} icon={TrendingUp}   color="green" />
        <StatCard label="Classes"       value={stats?.total_classes || 0} icon={BookOpen}    color="gold"  />
        <StatCard label="Active Tasks"  value={stats?.total_tasks  || 0} icon={ClipboardList} color="gray" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Class performance */}
        <div className="card lg:col-span-2">
          <SectionHeader title="Class Performance" subtitle="Task completion rate by class" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_PERF} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="completion" fill="#065F46" radius={[3,3,0,0]} name="Completion" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Users by role pie */}
        <div className="card">
          <SectionHeader title="Users by Role" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={roleData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {roleData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {roleData.map((r, i) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="capitalize text-gray-600">{r.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { to: '/org/users',   icon: UserPlus,  label: 'Add Staff',     color: 'bg-primary-900' },
          { to: '/org/classes', icon: BookOpen,  label: 'Manage Classes',color: 'bg-gov-green'   },
          { to: '/org/users',   icon: Upload,    label: 'Upload Students',color: 'bg-gov-gold'   },
          { to: '/org/analytics',icon: TrendingUp,label: 'Analytics',    color: 'bg-gray-700'    },
        ].map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to} className="card flex flex-col items-center gap-2 py-5 hover:shadow-panel transition-shadow text-center">
            <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
              <Icon size={18} className="text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recent users */}
      <div className="card">
        <SectionHeader
          title="Recent Users"
          action={<Link to="/org/users" className="btn-secondary text-xs py-1.5 px-3">View All</Link>}
        />
        <DataTable columns={recentUserCols} data={users} loading={false} emptyMessage="No users yet" />
      </div>
    </DashboardLayout>
  )
}
