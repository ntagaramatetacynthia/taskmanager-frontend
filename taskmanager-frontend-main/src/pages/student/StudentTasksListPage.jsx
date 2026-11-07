import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import { taskAPI } from '../../services/api'
import FocusStatusPill from '../../features/focus/FocusStatusPill'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'

function isOverdue(dateStr) {
  return dateStr && new Date(dateStr) < new Date()
}

export default function StudentTasksListPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const { data } = await taskAPI.getAll({ limit: 100 })
      setTasks(data.data || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) ||
                         task.description?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'pending' && !task.my_submission) ||
                         (statusFilter === 'submitted' && ['submitted', 'resubmitted'].includes(task.my_submission?.status)) ||
                         (statusFilter === 'graded' && task.my_submission?.status === 'graded')
    return matchesSearch && matchesStatus
  })

  const pending   = tasks.filter(t => !t.my_submission).length
  const submitted = tasks.filter(t => ['submitted', 'resubmitted'].includes(t.my_submission?.status)).length
  const graded    = tasks.filter(t => t.my_submission?.status === 'graded').length
  const overdue   = tasks.filter(t => !t.my_submission && isOverdue(t.due_date)).length

  if (loading) return <DashboardLayout title="My Tasks"><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout
      title="My Tasks"
      subtitle={`${user?.organization?.name || ''} · ${user?.role === 'intern' ? 'Intern' : 'Student'}`}
    >
      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All', count: tasks.length },
              { key: 'pending', label: 'Pending', count: pending },
              { key: 'submitted', label: 'Submitted', count: submitted },
              { key: 'graded', label: 'Graded', count: graded }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Total Tasks</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">{tasks.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-2">{pending}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Submitted</span>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-2">{submitted}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-900 mt-2">{overdue}</p>
        </div>
      </div>

      {/* Tasks List */}
      <div className="card">
        <SectionHeader title={`Tasks (${filteredTasks.length})`} />
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const sub = task.my_submission
            const late = !sub && isOverdue(task.due_date)
            const displayStatus = sub?.status || 'pending'
            return (
              <Link
                key={task.id}
                to={`/student/tasks/${task.id}`}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm',
                  late                                                          ? 'bg-red-50/60 border-red-200'         :
                  displayStatus === 'graded'                                    ? 'bg-emerald-50/60 border-emerald-200' :
                  ['submitted', 'resubmitted'].includes(displayStatus)          ? 'bg-blue-50/60 border-blue-200'       :
                  'bg-white border-gray-100 hover:border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-2 h-12 rounded-full flex-shrink-0',
                    task.priority === 'urgent' ? 'bg-red-500'    :
                    task.priority === 'high'   ? 'bg-amber-500'  :
                    task.priority === 'medium' ? 'bg-blue-500'   :
                    'bg-gray-300'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{task.class?.name}</span>
                      <span className="text-gray-300">·</span>
                      <span className={clsx('text-xs', late ? 'text-red-600 font-medium' : 'text-gray-500')}>
                        {late ? '⚠ Overdue · ' : 'Due: '}
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{task.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {sub?.score !== null && sub?.score !== undefined && (
                    <span className="text-sm font-bold text-gov-green">{sub.score}/{task.max_score || 100}</span>
                  )}
                  {(task.type === 'exam' || task.type === 'quiz') && <FocusStatusPill taskId={task.id} />}
                  <Badge status={displayStatus} />
                </div>
              </Link>
            )
          })}
          {filteredTasks.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">
              {search || statusFilter !== 'all' ? 'No tasks match your filters.' : 'No tasks assigned yet.'}
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}