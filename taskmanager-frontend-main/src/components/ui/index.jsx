import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'
import clsx from 'clsx'

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = 'blue', trend, sub }) {
  const colors = {
    blue:  { bg: 'bg-blue-50',   icon: 'bg-primary-900 text-white',  val: 'text-primary-900'  },
    green: { bg: 'bg-emerald-50',icon: 'bg-gov-green text-white',    val: 'text-gov-green'    },
    gold:  { bg: 'bg-amber-50',  icon: 'bg-gov-gold text-white',     val: 'text-gov-gold'     },
    red:   { bg: 'bg-red-50',    icon: 'bg-red-600 text-white',      val: 'text-red-600'      },
    gray:  { bg: 'bg-gray-50',   icon: 'bg-gray-600 text-white',     val: 'text-gray-700'     },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={clsx('card flex items-start gap-4', c.bg, 'border-0')}>
      {Icon && (
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', c.icon)}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={clsx('text-2xl font-bold mt-0.5', c.val)}>{value ?? '—'}</p>
        {sub   && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        {trend && <p className={clsx('text-xs font-medium mt-1', trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
        </p>}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ status }) {
  const map = {
    pending:   'badge-pending',
    approved:  'badge-approved',
    rejected:  'badge-rejected',
    active:    'badge-active',
    inactive:  'badge-inactive',
    suspended: 'badge-rejected',
    paid:      'badge-approved',
    overdue:   'badge-rejected',
    submitted: 'badge-active',
    graded:    'badge-approved',
    draft:     'badge-inactive',
    published: 'badge-approved',
    late:      'badge-pending',
  }
  return (
    <span className={map[status] || 'badge-inactive'}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-xl shadow-xl w-full', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-200 border-t-primary-900', s[size], className)} />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Icon size={24} className="text-gray-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', message }) {
  const styles = {
    info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',   Icon: Info         },
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800',  Icon: CheckCircle  },
    error:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-800',    Icon: AlertCircle  },
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800',  Icon: AlertCircle  },
  }
  const { bg, text, Icon } = styles[type] || styles.info
  return (
    <div className={clsx('flex items-start gap-2.5 p-3 rounded-lg border text-sm', bg, text)}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Data Table ────────────────────────────────────────────────────────────────
export function DataTable({ columns, data, loading, emptyMessage = 'No data found' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {columns.map((col) => (
              <th key={col.key} className={clsx('table-header', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center">
                <div className="flex justify-center"><Spinner /></div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-gray-50/60 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={clsx('table-cell', col.className)}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-500">Page {page} of {pages}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          Prev
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
