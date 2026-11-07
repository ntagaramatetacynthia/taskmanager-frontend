import DashboardLayout from '../../components/layout/DashboardLayout'
import { SectionHeader, StatCard } from '../../components/ui/index.jsx'
import { Building2, Users, TrendingUp, CreditCard } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

const MONTHLY = [
  { month: 'Sep', schools: 3, companies: 1 },
  { month: 'Oct', schools: 5, companies: 2 },
  { month: 'Nov', schools: 4, companies: 3 },
  { month: 'Dec', schools: 7, companies: 2 },
  { month: 'Jan', schools: 5, companies: 4 },
  { month: 'Feb', schools: 9, companies: 3 },
]

const SUBMISSION_RATE = [
  { week: 'W1', rate: 72 }, { week: 'W2', rate: 78 },
  { week: 'W3', rate: 65 }, { week: 'W4', rate: 84 },
  { week: 'W5', rate: 88 }, { week: 'W6', rate: 91 },
]

const ORG_STATUS = [
  { name: 'Approved',  value: 18, color: '#065F46' },
  { name: 'Pending',   value: 3,  color: '#D97706' },
  { name: 'Rejected',  value: 2,  color: '#DC2626' },
  { name: 'Suspended', value: 1,  color: '#6B7280' },
]

export default function DistrictAnalytics() {
  return (
    <DashboardLayout title="Analytics" subtitle="District-wide performance and activity metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Organizations" value={24}    icon={Building2}  color="blue"  />
        <StatCard label="Total Users"         value={1240}  icon={Users}      color="green" />
        <StatCard label="Avg Submission Rate" value="81%"   icon={TrendingUp} color="gold"  />
        <StatCard label="Revenue (RWF)"       value="1.2M"  icon={CreditCard} color="gray"  />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Registrations over time */}
        <div className="card">
          <SectionHeader title="New Registrations" subtitle="Schools vs Companies per month" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MONTHLY} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="schools"   fill="#1E3A8A" radius={[3,3,0,0]} name="Schools"   />
              <Bar dataKey="companies" fill="#D97706" radius={[3,3,0,0]} name="Companies" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Submission rate trend */}
        <div className="card">
          <SectionHeader title="Submission Rate Trend" subtitle="Weekly average across all organizations" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={SUBMISSION_RATE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[50, 100]} />
              <Tooltip formatter={v => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="rate" stroke="#065F46" strokeWidth={2} dot={{ r: 4, fill: '#065F46' }} name="Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Org status pie */}
        <div className="card">
          <SectionHeader title="Organization Status" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={ORG_STATUS} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                {ORG_STATUS.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {ORG_STATUS.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-gray-600">{s.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top performing orgs */}
        <div className="card lg:col-span-2">
          <SectionHeader title="Top Performing Organizations" subtitle="By task submission rate" />
          <div className="space-y-3">
            {[
              { name: 'Kigali Secondary School', rate: 94, type: 'school'  },
              { name: 'TechCorp Rwanda',          rate: 91, type: 'company' },
              { name: 'Gasabo Primary School',    rate: 88, type: 'school'  },
              { name: 'Rwanda Finance Ltd',       rate: 85, type: 'company' },
              { name: 'Nyarugenge High School',   rate: 82, type: 'school'  },
            ].map((org, i) => (
              <div key={org.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-800">{org.name}</span>
                    <span className="text-xs font-bold text-primary-900">{org.rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${org.rate}%`, background: org.type === 'school' ? '#1E3A8A' : '#D97706' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
