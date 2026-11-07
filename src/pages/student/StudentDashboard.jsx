import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Bell, TrendingUp, Calendar, Target } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { StatCard, Badge, SectionHeader } from '../../components/ui/index.jsx'
import { userAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import toast from 'react-hot-toast'

function isOverdue(dateStr) {
  return dateStr && new Date(dateStr) < new Date()
}

// A task that has not been submitted yet carries `my_submission: null`, for which
// `my_submission?.score !== null` is still true (undefined !== null). That made the
// average-score reduce below dereference null and crash the whole dashboard as soon
// as a student had one pending task.
function hasGradedScore(task) {
  const score = task?.my_submission?.score
  return score !== null && score !== undefined
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const { data } = await userAPI.getStudentDashboard()
      setDashboardData(data.data)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="My Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!dashboardData) {
    return (
      <DashboardLayout title="My Dashboard" subtitle="Error loading dashboard">
        <div className="text-center py-12">
          <p className="text-gray-500">Unable to load dashboard data. Please try again.</p>
        </div>
      </DashboardLayout>
    )
  }

  const { profile, tasks, stats, recent_reminders, upcoming_deadlines } = dashboardData

  return (
    <DashboardLayout
      title="My Dashboard"
      subtitle={`${profile?.organization?.name || ''} · Student ID: ${profile?.student_id || ''}`}
    >
      {/* Enhanced Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Total Tasks"
          value={stats.total_tasks}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          label="Completed"
          value={`${stats.completion_rate}%`}
          icon={TrendingUp}
          color="green"
          subtitle={`${stats.submitted_tasks} submitted`}
        />
        <StatCard
          label="Due Soon"
          value={stats.due_soon_tasks}
          icon={Clock}
          color="amber"
          subtitle="Next 3 days"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue_tasks}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label="Avg Score"
          value={tasks.filter(hasGradedScore).length > 0
            ? Math.round(tasks
                .filter(hasGradedScore)
                .reduce((acc, t) => {
                  const max = t.my_submission.max_score || t.max_score || 100
                  return acc + (t.my_submission.score / max * 100)
                }, 0)
                / tasks.filter(hasGradedScore).length
              ) + '%'
            : 'N/A'
          }
          icon={Target}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Tasks Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Deadlines */}
          {upcoming_deadlines.length > 0 && (
            <div className="card">
              <SectionHeader
                title="Upcoming Deadlines"
                subtitle={`Next ${upcoming_deadlines.length} tasks due`}
                icon={Calendar}
              />
              <div className="space-y-3">
                {upcoming_deadlines.map(task => {
                  const daysLeft = task.days_until_due
                  const isUrgent = daysLeft <= 1
                  return (
                    <Link
                      key={task.id}
                      to={`/student/tasks/${task.id}`}
                      className={clsx(
                        'flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm',
                        isUrgent ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-2 h-8 rounded-full flex-shrink-0',
                          isUrgent ? 'bg-red-500' : 'bg-amber-500'
                        )} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                          <p className="text-xs text-gray-500">
                            Due in {daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                      <Badge status={task.my_submission ? 'submitted' : 'pending'} />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Tasks */}
          <div className="card">
            <SectionHeader title="All Tasks" subtitle={`${tasks.length} assigned tasks`} />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tasks.map(task => {
                const sub = task.my_submission
                const late = !sub && task.is_overdue
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
                        'w-2 h-10 rounded-full flex-shrink-0',
                        task.priority === 'urgent' ? 'bg-red-500'    :
                        task.priority === 'high'   ? 'bg-amber-500'  :
                        task.priority === 'medium' ? 'bg-blue-500'   :
                        'bg-gray-300'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 truncate">{task.class?.name}</span>
                          <span className="text-gray-300">·</span>
                          <span className={clsx('text-xs flex-shrink-0', late ? 'text-red-600 font-medium' : 'text-gray-500')}>
                            {late ? '⚠ Overdue' : `Due: ${new Date(task.due_date).toLocaleDateString()}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {sub?.score !== null && sub?.score !== undefined && (
                        <span className="text-sm font-bold text-gov-green">{sub.score}/{task.max_score || 100}</span>
                      )}
                      <Badge status={displayStatus} />
                    </div>
                  </Link>
                )
              })}
              {tasks.length === 0 && (
                <p className="text-sm text-gray-400 py-8 text-center">No tasks assigned yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Notifications */}
          {recent_reminders.length > 0 && (
            <div className="card">
              <SectionHeader
                title="Recent Notifications"
                subtitle="Last 7 days"
                icon={Bell}
              />
              <div className="space-y-3">
                {recent_reminders.slice(0, 5).map(reminder => (
                  <div key={reminder.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Bell className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">
                        Reminder: {reminder.task?.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(reminder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Profile Card */}
          <div className="card">
            <SectionHeader title="My Profile" subtitle="Student Information" />
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Student ID</span>
                <span className="text-sm font-medium">{profile.student_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Class</span>
                <span className="text-sm font-medium">{profile.class?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Organization</span>
                <span className="text-sm font-medium">{profile.organization?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Role</span>
                <span className="text-sm font-medium capitalize">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <SectionHeader title="Quick Actions" subtitle="Common tasks" />
            <div className="space-y-2">
              <Link
                to="/student/tasks"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                View All Tasks
              </Link>
              <Link
                to="/student/results"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                View Results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
