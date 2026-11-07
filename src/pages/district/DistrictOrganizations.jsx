import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, PauseCircle, Search, Filter } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, DataTable, Modal, SectionHeader, Pagination, Alert } from '../../components/ui/index.jsx'
import { districtAPI } from '../../services/api'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'suspended']

export default function DistrictOrganizations() {
  const [orgs, setOrgs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [modal, setModal]       = useState(null) // { type: 'approve'|'reject'|'suspend', org }
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (filter !== 'all') params.status = filter
      const { data } = await districtAPI.getAll(params)
      setOrgs(data.data || [])
      setPages(data.pagination?.pages || 1)
    } catch {
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const openModal = (type, org) => {
    reset()
    setModal({ type, org })
  }

  const onAction = async (values) => {
    if (!modal) return
    setSubmitting(true)
    try {
      if (modal.type === 'approve') {
        const { data: res } = await districtAPI.approve(modal.org.id, { approval_notes: values.notes })
        const code = res.data?.organization_code
        const creds = res.data?.login_credentials
        toast.success(`${modal.org.name} approved! Code: ${code}`)
        if (creds) {
          toast(`Admin login created:\nEmail: ${creds.email}\nPassword: ${creds.password}`, { duration: 10000, icon: '🔑' })
        }
      } else if (modal.type === 'reject') {
        await districtAPI.reject(modal.org.id, { rejection_reason: values.reason })
        toast.success(`${modal.org.name} rejected.`)
      } else if (modal.type === 'suspend') {
        await districtAPI.suspend(modal.org.id, { reason: values.reason })
        toast.success('Organization status updated.')
      }
      setModal(null)
      load()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Action failed'
      toast.error(msg)
      console.error('Action error:', err.response?.data || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.contact_email?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { key: 'name',           label: 'Organization',
      render: r => <div><p className="font-medium text-gray-900 text-sm">{r.name}</p><p className="text-xs text-gray-400">{r.contact_email}</p></div>
    },
    { key: 'type',           label: 'Type',    render: r => <span className="capitalize text-xs">{r.type}</span> },
    { key: 'code',           label: 'Code',    render: r => r.code ? <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{r.code}</code> : <span className="text-gray-400 text-xs">—</span> },
    { key: 'payment_status', label: 'Payment', render: r => <Badge status={r.payment_status} /> },
    { key: 'status',         label: 'Status',  render: r => <Badge status={r.status} /> },
    { key: 'created_at',     label: 'Submitted',
      render: r => <span className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
    },
    { key: 'actions', label: 'Actions',
      render: r => (
        <div className="flex items-center gap-1.5">
          {r.status === 'pending' && (
            <>
              <button onClick={() => openModal('approve', r)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" title="Approve">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => openModal('reject', r)} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Reject">
                <XCircle size={14} />
              </button>
            </>
          )}
          {r.status === 'approved' && (
            <button onClick={() => openModal('suspend', r)} className="p-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" title="Suspend">
              <PauseCircle size={14} />
            </button>
          )}
          {r.status === 'suspended' && (
            <button onClick={() => openModal('suspend', r)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" title="Reactivate">
              <CheckCircle size={14} />
            </button>
          )}
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="Organizations" subtitle="Manage and approve organizations in your district">
      <div className="card">
        {/* Filters */}
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
                  filter === s
                    ? 'bg-primary-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No organizations found" />
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      {/* Approve Modal */}
      <Modal open={modal?.type === 'approve'} onClose={() => setModal(null)} title={`Approve: ${modal?.org?.name}`}>
        <form onSubmit={handleSubmit(onAction)} className="space-y-4">
          <Alert type="success" message="Approving will generate a unique organization code and activate their account." />
          <div>
            <label className="label">Approval Notes (optional)</label>
            <textarea {...register('notes')} rows={3} placeholder="Any conditions or notes..." className="input resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success">
              {submitting ? 'Approving...' : 'Approve Organization'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={modal?.type === 'reject'} onClose={() => setModal(null)} title={`Reject: ${modal?.org?.name}`}>
        <form onSubmit={handleSubmit(onAction)} className="space-y-4">
          <Alert type="error" message="The organization will be notified of the rejection." />
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea
              {...register('reason', { required: 'Reason is required' })}
              rows={3}
              placeholder="Explain why this organization is being rejected..."
              className="input resize-none"
            />
            {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-danger">
              {submitting ? 'Rejecting...' : 'Reject Organization'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend Modal */}
      <Modal open={modal?.type === 'suspend'} onClose={() => setModal(null)} title={`${modal?.org?.status === 'suspended' ? 'Reactivate' : 'Suspend'}: ${modal?.org?.name}`}>
        <form onSubmit={handleSubmit(onAction)} className="space-y-4">
          <Alert
            type="warning"
            message={modal?.org?.status === 'suspended'
              ? 'This will reactivate the organization and restore user access.'
              : 'This will suspend the organization and block all user access.'
            }
          />
          <div>
            <label className="label">Reason</label>
            <textarea {...register('reason')} rows={2} placeholder="Optional reason..." className="input resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-gold">
              {submitting ? 'Processing...' : modal?.org?.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
