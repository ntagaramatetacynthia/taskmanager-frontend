import { useState, useEffect } from 'react'
import { CheckCircle, TrendingUp } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatCard, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import { taskAPI } from '../../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function StudentResultsPage() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    taskAPI.getAll({ limit: 50 })
      .then(({ data }) => setTasks(data.data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLayout title="My Results"><PageLoader /></DashboardLayout>

  const graded  = tasks.filter(t => t.my_submission?.status === 'graded' && t.my_submission?.score !== null)
  const avg     = graded.length ? Math.round(graded.reduce((s, t) => s + t.my_submission.score, 0) / graded.length) : 0
  const highest = graded.length ? Math.max(...graded.map(t => t.my_submission.score)) : 0
  const passed  = graded.filter(t => t.my_submission.score >= 50).length

  const chartData = graded.slice(0, 10).map(t => ({
    name: t.title?.length > 12 ? t.title.slice(0, 12) + '…' : t.title,
    score: t.my_submission.score,
    max: t.max_score || 100,
  }))

  return (
    <DashboardLayout title="My Results" subtitle="Grades and performance overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Graded Tasks"  value={graded.length} icon={CheckCircle} color="green" />
        <StatCard label="Average Score" value={`${avg}%`}     icon={TrendingUp}  color="blue"  />
        <StatCard label="Highest Score" value={highest}       icon={TrendingUp}  color="gold"  />
        <StatCard label="Passed"        value={passed}        icon={CheckCircle} color="gray"  />
      </div>

      {chartData.length > 0 && (
        <div className="card mb-5">
          <SectionHeader title="Score History" subtitle="Your recent graded tasks" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="score" fill="#1E3A8A" radius={[3,3,0,0]} name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <SectionHeader title="All Graded Tasks" />
        {graded.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No graded tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {graded.map(task => {
              const score = task.my_submission.score
              const max   = task.max_score || 100
              return (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-white">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.subject?.name || task.class?.name || '—'}</p>
                    {task.my_submission.feedback && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{task.my_submission.feedback}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${score >= 50 ? 'text-gov-green' : 'text-red-500'}`}>
                      {score}/{max}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${score >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {score >= 50 ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
