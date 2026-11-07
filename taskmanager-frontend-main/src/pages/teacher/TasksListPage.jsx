import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, DataTable, Pagination } from '../../components/ui/index.jsx'
import EditTaskModal from '../../components/teacher/EditTaskModal.jsx'
import { taskAPI } from '../../services/api'
import clsx from 'clsx'

const STATUS_FILTERS = ['all', 'draft', 'published', 'closed']

export default function TasksListPage() {
  const [tasks, setTasks]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [pages, setPages]             = useState(1)
  const [editingTask, setEditingTask] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (filter !== 'all') params.status = filter
      const { data } = await taskAPI.getAll(params)
      setTasks(data.data || [])
      setPages(data.pagination?.pages || 1)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const onDeleteTask = async (id, title) => {
    if (!confirm(`Delete task "${title}"?`)) return
    try {
      await taskAPI.remove(id)
      toast.success('Task deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task')
    }
  }

  const filtered = tasks.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { key: 'title', label: 'Task',
      className: 'min-w-[180px]',
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
          <p className="text-xs text-gray-400 capitalize">{r.type} · {r.class?.name || '—'}</p>
        </div>
      )
    },
    { key: 'due_date', label: 'Due Date',
      className: 'whitespace-nowrap min-w-[110px]',
      render: r => <span className="text-xs text-gray-600">{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</span>
    },
    { key: 'priority', label: 'Priority', className: 'whitespace-nowrap', render: r => <Badge status={r.priority} /> },
    { key: 'status',   label: 'Status',   className: 'whitespace-nowrap', render: r => <Badge status={r.status} /> },
    { key: 'actions',  label: '',
      className: 'whitespace-nowrap text-right min-w-[200px]',
      render: r => (
        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setEditingTask(r)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 rounded hover:bg-gray-100 hover:text-primary-900 transition-colors"
            title="Edit Task"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDeleteTask(r.id, r.title)}
            className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete Task"
          >
            <Trash2 size={13} />
          </button>
          <Link to={`/teacher/tasks/${r.id}`} className="text-xs text-primary-900 font-medium hover:underline whitespace-nowrap">
            View Submissions →
          </Link>
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="My Tasks" subtitle="All tasks you have created">
      <div className="card w-full max-w-full overflow-hidden p-4 sm:p-6">
        {/* Controls: Search, Filters, New Task */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
          <div className="relative w-full lg:flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="input pl-9 w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => { setFilter(s); setPage(1) }}
                  className={clsx(
                    'px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-colors flex-1 sm:flex-initial text-center',
                    filter === s ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >{s}</button>
              ))}
            </div>
            <Link
              to="/teacher/create-task"
              className="btn-primary text-xs py-2 sm:py-1.5 px-3 flex items-center justify-center gap-1.5 w-full sm:w-auto flex-shrink-0"
            >
              <Plus size={13} /> New Task
            </Link>
          </div>
        </div>

        {/* Table container with horizontal scroll handling on mobile */}
        <div className="w-full overflow-x-auto">
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No tasks found" />
        </div>

        {/* Responsive Pagination wrapper */}
        <div className="mt-4 pt-3 border-t border-gray-100 w-full overflow-x-auto">
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      <EditTaskModal
        open={Boolean(editingTask)}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={load}
      />
    </DashboardLayout>
  )
}
