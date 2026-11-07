import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, CheckCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatCard, Badge, DataTable, PageLoader, SectionHeader } from '../../components/ui/index.jsx'
import { districtAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const MOCK_CHART = [
  { month: 'Sep', approved: 4, rejected: 1 },
  { month: 'Oct', approved: 7, rejected: 2 },
  { month: 'Nov', approved: 5, rejected: 1 },
  { month: 'Dec', approved: 9, rejected: 3 },
  { month: 'Jan', approved: 6, rejected: 1 },
  { month: 'Feb', approved: 11, rejected: 2 },
]

export default function DistrictDashboard() {
  const { user } = useAuth()
  const [stats, setStats]     = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([districtAPI.getStats(), districtAPI.getPending()])
      .then(([s, p]) => {
        setStats(s.data.data)
        setPending(p.data.data?.slice(0, 5) || [])
      })
      .catch(() => {
        setStats(null)
        setPending([])
      })
      .finally(() => setLoading(false))
  }, [])

  const pendingCount  = stats?.organizations_by_status?.find(s => s.status === 'pending')?.count  || 0
  const approvedCount = stats?.organizations_by_status?.find(s => s.status === 'approved')?.count || 0

  const columns = [
    { key: 'name',           label: 'Organization'    },
    { key: 'type',           label: 'Type',           render: r => <span className="capitalize">{r.type}</span> },
    { key: 'contact_email',  label: 'Email'           },
    { key: 'payment_status', label: 'Payment',        render: r => <Badge status={r.payment_status} /> },
    { key: 'status',         label: 'Status',         render: r => <Badge status={r.status} /> },
    { key: 'actions',        label: '',
      render: r => (
        <Link to={`/district/organizations`} className="text-xs text-primary-900 font-medium hover:underline">
          Review →
        </Link>
      )
    },
  ]

  if (loading) return <DashboardLayout title="Dashboard"><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout
      title={`District Dashboard`}
      subtitle={`${user?.district?.name || 'Your District'} · District Admin`}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Organizations" value={stats?.total_organizations || 0}  icon={Building2}   color="blue"  />
        <StatCard label="Pending Approval"    value={pendingCount || 0}                  icon={Clock}       color="gold"  />
        <StatCard label="Approved"            value={approvedCount || 0}                icon={CheckCircle} color="green" />
        <StatCard label="Total Users"         value={stats?.total_users || 0}         icon={Users}       color="gray"  />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Approval trend chart */}
        <div className="card lg:col-span-2">
          <SectionHeader title="Approval Trends" subtitle="Monthly organization approvals vs rejections" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_CHART} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="approved" fill="#1E3A8A" radius={[3,3,0,0]} name="Approved" />
              <Bar dataKey="rejected" fill="#D97706" radius={[3,3,0,0]} name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick actions */}
        <div className="card">
          <SectionHeader title="Quick Actions" />
          <div className="space-y-2">
            <Link to="/district/organizations" className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Pending Approvals</span>
              </div>
              <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold">
                {pendingCount || 0}
              </span>
            </Link>
            <Link to="/district/organizations" className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-primary-900" />
                <span className="text-sm font-medium text-primary-900">All Organizations</span>
              </div>
              <span className="text-xs text-primary-900 font-medium">View →</span>
            </Link>
            <Link to="/district/analytics" className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-gov-green" />
                <span className="text-sm font-medium text-gov-green">Analytics</span>
              </div>
              <span className="text-xs text-gov-green font-medium">View →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Pending organizations table */}
      <div className="card">
        <SectionHeader
          title="Recent Pending Approvals"
          subtitle="Organizations awaiting your review"
          action={
            <Link to="/district/organizations" className="btn-secondary text-xs py-1.5 px-3">
              View All
            </Link>
          }
        />
        <DataTable
          columns={columns}
          data={pending}
          loading={false}
          emptyMessage="No pending organizations"
        />
      </div>
    </DashboardLayout>
  )
}
