import { useState, useEffect } from 'react'
import { Users, BookOpen, ClipboardList, TrendingUp } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatCard, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import { orgAPI, taskAPI, classAPI } from '../../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const PIE_COLORS = ['#1E3A8A', '#065F46', '#D97706', '#6B7280', '#7C3AED']

export default function OrgAnalyticsPage() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    orgAPI.getStats()
      .then(({ data }) => setStats(data.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLayout title="Analytics"><PageLoader /></DashboardLayout>

  const roleData = stats?.users_by_role?.map(r => ({
    name: r.role,
    value: parseInt(r.count)
  })) || []

  return (
    <DashboardLayout title="Analytics" subtitle="Organization performance and activity metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users"  value={stats?.total_users  || 0} icon={Users}        color="blue"  />
        <StatCard label="Active Users" value={stats?.active_users || 0} icon={TrendingUp}   color="green" />
        <StatCard label="Classes"      value={stats?.total_classes || 0} icon={BookOpen}    color="gold"  />
        <StatCard label="Total Tasks"  value={stats?.total_tasks  || 0} icon={ClipboardList} color="gray" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {roleData.length > 0 && (
          <div className="card">
            <SectionHeader title="Users by Role" />
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {roleData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats?.task_completion_by_class?.length > 0 && (
          <div className="card">
            <SectionHeader title="Task Completion by Class" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.task_completion_by_class} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={v => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="completion" fill="#065F46" radius={[3,3,0,0]} name="Completion" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!roleData.length && !stats?.task_completion_by_class?.length && (
          <div className="card lg:col-span-2 flex items-center justify-center py-16 text-gray-400 text-sm">
            No analytics data available yet.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
