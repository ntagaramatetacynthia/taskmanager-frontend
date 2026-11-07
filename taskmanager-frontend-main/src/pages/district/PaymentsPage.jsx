import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, DataTable, Pagination } from '../../components/ui/index.jsx'
import { districtAPI } from '../../services/api'
import clsx from 'clsx'

const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue']

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (filter !== 'all') params.payment_status = filter
      const { data } = await districtAPI.getAll(params)
      setPayments(data.data || [])
      setPages(data.pagination?.pages || 1)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const filtered = payments.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_email?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { key: 'name', label: 'Organization',
      render: r => <div><p className="text-sm font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-400">{r.contact_email}</p></div>
    },
    { key: 'type',           label: 'Type',    render: r => <span className="capitalize text-xs">{r.type}</span> },
    { key: 'payment_status', label: 'Payment', render: r => <Badge status={r.payment_status} /> },
    { key: 'status',         label: 'Status',  render: r => <Badge status={r.status} /> },
    { key: 'subscription_expires', label: 'Expires',
      render: r => <span className="text-xs text-gray-500">{r.subscription_expires ? new Date(r.subscription_expires).toLocaleDateString() : '—'}</span>
    },
    { key: 'created_at', label: 'Registered',
      render: r => <span className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
    },
  ]

  return (
    <DashboardLayout title="Payments" subtitle="Organization payment and subscription status">
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search organizations..."
              className="input pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => { setFilter(s); setPage(1) }}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-colors',
                  filter === s ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >{s}</button>
            ))}
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No payment records found" />
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>
    </DashboardLayout>
  )
}
